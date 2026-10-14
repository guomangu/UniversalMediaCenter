import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes, iptvSources, eavValues, eavAttributes } from '../db/schema/index.js';
import { eq, and, or, ilike, asc } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import { iptvSourcesRouter } from './iptvSources.js';

export const iptvRouter = new Hono();

// Déléguer la gestion des sources IPTV (Admin)
iptvRouter.route('/sources', iptvSourcesRouter);

iptvRouter.use('*', requireAuth);

iptvRouter.get('/channels', async (c) => {
  const q = c.req.query('q')?.trim();
  const category = c.req.query('category')?.trim();
  const limit = Math.min(parseInt(c.req.query('limit') || '300', 10), 500);

  const conditions = [eq(mediaNodes.nodeType, 'LIVE_CHANNEL')];
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

  return c.json({ count: channels.length, channels });
});

iptvRouter.get('/categories', async (c) => {
  try {
    const rows = await db
      .selectDistinct({ name: eavValues.valueText })
      .from(eavValues)
      .innerJoin(eavAttributes, eq(eavValues.attributeId, eavAttributes.id))
      .where(eq(eavAttributes.code, 'iptv_category'))
      .orderBy(asc(eavValues.valueText));

    const categories = rows.map((r) => r.name).filter(Boolean);
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
  const channel = await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.id, channelId),
  });

  if (!channel || !channel.streamUrl) {
    return c.text('Channel or stream not found', 404);
  }

  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  return c.redirect(channel.streamUrl, 302);
});
