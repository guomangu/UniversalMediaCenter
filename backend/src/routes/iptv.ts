import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes, iptvSources, eavValues, eavAttributes, nodeEavLinks } from '../db/schema/index.js';
import { eq, and, or, ilike, asc, not } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import type { UserSession } from '../middleware/access.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';
import { iptvSourcesRouter } from './iptvSources.js';
import { proxyLiveStream } from '../iptv/liveProxyService.js';

export const iptvRouter = new Hono();

// Déléguer la gestion des sources IPTV (Admin)
iptvRouter.route('/sources', iptvSourcesRouter);

iptvRouter.use('*', requireAuth);

iptvRouter.get('/channels', async (c) => {
  const user = (c as any).get('user') as UserSession | undefined;

  // Contrôle RBAC : si l'utilisateur n'a pas le droit de regarder l'IPTV
  if (user && user.canWatchIptv === false) {
    return c.json({ count: 0, channels: [] });
  }

  const q = c.req.query('q')?.trim();
  const category = c.req.query('category')?.trim();
  const limit = Math.min(parseInt(c.req.query('limit') || '300', 10), 500);

  const conditions = [
    eq(mediaNodes.nodeType, 'LIVE_CHANNEL'),
    not(ilike(mediaNodes.streamUrl, '%145.239.5.177%')),
  ];

  if (q) {
    conditions.push(
      or(
        ilike(mediaNodes.title, `%${q}%`),
        ilike(mediaNodes.searchVectorText, `%${q}%`)
      )!
    );
  }
  if (category && category !== 'ALL') {
    conditions.push(ilike(mediaNodes.searchVectorText, `%${category}%`));
  }

  const channels = await db
    .select()
    .from(mediaNodes)
    .where(and(...conditions))
    .orderBy(asc(mediaNodes.title))
    .limit(limit);

  // Filtrage strict ABAC sur les chaînes IPTV (tags bloqués / autorisés)
  const allowedChannels = channels.filter((ch) => isMediaAllowedForUser(user, ch));

  return c.json({ count: allowedChannels.length, channels: allowedChannels });
});

iptvRouter.get('/categories', async (c) => {
  const user = (c as any).get('user') as UserSession | undefined;
  if (user && user.canWatchIptv === false) {
    return c.json({ categories: [] });
  }

  try {
    const rows = await db
      .selectDistinct({ name: eavValues.valueText })
      .from(eavValues)
      .innerJoin(eavAttributes, eq(eavValues.attributeId, eavAttributes.id))
      .innerJoin(nodeEavLinks, eq(eavValues.id, nodeEavLinks.valueId))
      .innerJoin(mediaNodes, eq(nodeEavLinks.nodeId, mediaNodes.id))
      .where(
        and(
          eq(eavAttributes.code, 'iptv_category'),
          eq(mediaNodes.nodeType, 'LIVE_CHANNEL')
        )
      )
      .orderBy(asc(eavValues.valueText));

    const categories = rows
      .map((r) => r.name)
      .filter(Boolean)
      .filter((catName) => {
        if (!user || user.isAdmin) return true;
        if (user.blockedTags && user.blockedTags.some((bt) => catName?.toLowerCase().includes(bt.toLowerCase()))) {
          return false;
        }
        return true;
      });

    return c.json({ categories });
  } catch {
    return c.json({ categories: [] });
  }
});

iptvRouter.post('/sync-epg', async (c) => {
  const sources = await db.query.iptvSources.findMany({
    where: (t, { eq }) => eq(t.isActive, true),
  });

  let syncedSources = 0;
  for (const src of sources) {
    if (!src.epgXmltvUrl) continue;
    try {
      const res = await fetch(src.epgXmltvUrl);
      if (res.ok) {
        await db.update(iptvSources).set({ lastSyncedAt: new Date() }).where(eq(iptvSources.id, src.id));
        syncedSources++;
      }
    } catch (e) {}
  }

  return c.json({ success: true, syncedSources, totalSources: sources.length });
});

iptvRouter.get('/stream/:channelId/live.m3u8', async (c) => {
  const channelId = c.req.param('channelId');
  const user = (c as any).get('user') as UserSession | undefined;

  if (user && user.canWatchIptv === false) {
    return c.text('Accès refusé : la télévision en direct n\'est pas autorisée pour votre profil', 403);
  }

  const channel = await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.id, channelId),
  });

  if (!channel || !channel.streamUrl) {
    return c.text('Channel or stream not found', 404);
  }

  if (!isMediaAllowedForUser(user, channel)) {
    return c.text('Accès refusé à cette chaîne', 403);
  }

  return await proxyLiveStream(c, channel.streamUrl);
});
