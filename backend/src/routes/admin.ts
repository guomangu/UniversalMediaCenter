import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, eavAttributes, mediaNodes } from '../db/schema/index.js';
import { eq, asc, lt } from 'drizzle-orm';
import { requireAdmin } from '../middleware/access.js';
import { enrichLibraryMetadata } from '../watcher/metadataEnricher.js';
import { runBootMediaScan, getScanStatus } from '../watcher/bootScanner.js';
import { repairAllMediaHierarchy } from '../watcher/hierarchyRepair.js';
import { parseMediaChaosRoots } from '../watcher/rootConfig.js';
import { cleanShowTitle, fetchExternalMetadata } from '../watcher/externalMetadata.js';
import { linkTagToNode } from '../watcher/tagExtractor.js';
import { configRouter } from './configRoutes.js';
import { userAdminRouter } from './userAdminRoutes.js';
import { profileTypesRouter } from './profileTypesRoutes.js';

export const adminRouter = new Hono();
adminRouter.use('*', requireAdmin);

// Sous-routeurs modulaires pour la configuration, les utilisateurs et les types de profils (Packs)
adminRouter.route('/config', configRouter);
adminRouter.route('/users', userAdminRouter);
adminRouter.route('/profile-types', profileTypesRouter);

adminRouter.post('/library/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const limit = Math.min(parseInt(body.limit || '50', 10), 100);
  const result = await enrichLibraryMetadata(limit);
  return c.json({
    success: true,
    message: `Enrichissement terminé : ${result.enrichedCount}/${result.processedCount} médias enrichis`,
    ...result,
  });
});

adminRouter.post('/scan/rebuild-hierarchy', async (c) => {
  const report = await repairAllMediaHierarchy();
  return c.json({ success: true, message: 'Hiérarchie réparée et synchronisée avec succès', report });
});

adminRouter.post('/scan/trigger', async (c) => {
  const roots = parseMediaChaosRoots();
  // Lancer le pipeline universel complet en arrière-plan
  runBootMediaScan(roots).catch((err) => console.error('Erreur pipeline unifié:', err));
  return c.json({
    success: true,
    message: `Synchronisation Universelle Complète déclenchée sur ${roots.length} dossier(s) (Scan + Métadonnées + Hiérarchie + Sagas)`,
  });
});

adminRouter.get('/scan/status', async (c) => {
  const status = getScanStatus();

  const allNodes = await db.query.mediaNodes.findMany({
    columns: { id: true, nodeType: true, isExtra: true, confidenceScore: true },
  });

  const totalNodes = allNodes.length;
  const collectionsCount = allNodes.filter((n) => n.nodeType === 'COLLECTION').length;
  const moviesCount = allNodes.filter((n) => n.nodeType === 'MOVIE' && !n.isExtra).length;
  const showsCount = allNodes.filter((n) => n.nodeType === 'SHOW' && !n.isExtra).length;
  const episodesCount = allNodes.filter((n) => n.nodeType === 'EPISODE' && !n.isExtra).length;
  const extrasCount = allNodes.filter((n) => n.isExtra).length;
  const verifiedCount = allNodes.filter((n) => (n.confidenceScore ?? 1.0) >= 0.90).length;
  const toVerifyCount = allNodes.filter((n) => (n.confidenceScore ?? 1.0) < 0.90).length;

  const chaosRoots = parseMediaChaosRoots();

  return c.json({
    ...status,
    stats: {
      totalNodes,
      collectionsCount,
      moviesCount,
      showsCount,
      episodesCount,
      extrasCount,
      verifiedCount,
      toVerifyCount,
    },
    chaosRoots,
  });
});

adminRouter.get('/media/to-verify', async (c) => {
  const items = await db.query.mediaNodes.findMany({
    where: (t, { lt }) => lt(t.confidenceScore, 0.90),
    orderBy: (t, { asc }) => [asc(t.confidenceScore)],
    limit: 100,
  });
  return c.json({ items });
});

adminRouter.post('/media/:id/validate', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  await db
    .update(mediaNodes)
    .set({
      confidenceScore: 1.0,
      state: 'READY',
      updatedAt: new Date(),
    })
    .where(eq(mediaNodes.id, id));

  return c.json({ success: true, id, confidenceScore: 1.0 });
});

adminRouter.post('/media/:id/match', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const targetTitle = body.title || cleanShowTitle(media.title);
  const external = await fetchExternalMetadata(targetTitle, media.nodeType);

  if (!external) {
    return c.json({ error: 'Aucune correspondance trouvée sur les bases externes' }, 404);
  }

  const updates: Record<string, any> = {
    title: external.title || media.title,
    originalTitle: external.originalTitle || media.originalTitle,
    overview: external.overview || media.overview,
    tagline: external.tagline || media.tagline,
    releaseYear: external.releaseYear || media.releaseYear,
    communityRating: external.communityRating || media.communityRating,
    confidenceScore: 1.0,
    state: 'READY',
    updatedAt: new Date(),
  };

  if (external.posterUrl && !media.posterPath) updates.posterPath = external.posterUrl;
  if (external.fanartUrl && !media.fanartPath) updates.fanartPath = external.fanartUrl;

  await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, media.id));

  for (const g of external.genres) await linkTagToNode(media.id, 'genre', g).catch(() => null);
  for (const s of external.tags) await linkTagToNode(media.id, 'subject', s).catch(() => null);
  for (const a of external.actors) {
    await linkTagToNode(media.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(() => null);
  }

  return c.json({ success: true, matchedTitle: external.title, confidenceScore: 1.0 });
});

adminRouter.get('/rails', async (c) => {
  const rails = await db.query.uiRails.findMany({
    orderBy: [asc(uiRails.sortOrder)],
  });
  return c.json({ rails });
});

adminRouter.post('/rails/reorder', async (c) => {
  const { railOrders } = await c.req.json();
  for (const item of railOrders || []) {
    await db
      .update(uiRails)
      .set({ sortOrder: item.sortOrder })
      .where(eq(uiRails.id, item.id));
  }
  return c.json({ success: true });
});

adminRouter.get('/tags', async (c) => {
  const tags = await db.query.eavAttributes.findMany({
    orderBy: [asc(eavAttributes.displayOrder)],
  });
  return c.json({ tags });
});

adminRouter.patch('/tags/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { uiZone, displayOrder, colorTheme, displayName } = body;

  await db
    .update(eavAttributes)
    .set({ uiZone, displayOrder, colorTheme, displayName })
    .where(eq(eavAttributes.id, id));

  return c.json({ success: true });
});
