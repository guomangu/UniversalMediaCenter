import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, mediaNodes, eavAttributes, watchProgress } from '../db/schema/index.js';
import { desc, asc, eq, and } from 'drizzle-orm';
import { taxonomyRouter } from './taxonomyRoutes.js';
import { requireAuth } from '../middleware/access.js';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';

export const uiRouter = new Hono();

// Toutes les requêtes UI (listes, rails, tags, taxonomie) exigent d'être authentifié
uiRouter.use('*', requireAuth);

// Taxonomie hiérarchique Catégories < Tags < Médias
uiRouter.route('/taxonomy', taxonomyRouter);

function formatMediaItem(item: any) {
  const parsedInfo = parseSeasonEpisode(item.title, item.orderIndex);
  return {
    ...item,
    posterPath: item.posterPath ? `/api/media/${item.id}/poster` : undefined,
    fanartPath: item.fanartPath ? `/api/media/${item.id}/fanart` : undefined,
    seasonEpisodeTag: parsedInfo?.seasonEpisodeTag ?? null,
    displayBadge: parsedInfo?.displayBadge ?? null,
  };
}

uiRouter.get('/layout', async (c) => {
  const pageTarget = c.req.query('page') || 'HOME';
  const user = (c as any).get('user') as any;
  const rails = await db.query.uiRails.findMany({
    where: (t, { and, eq }) => and(eq(t.pageTarget, pageTarget), eq(t.isActive, true)),
    orderBy: [asc(uiRails.sortOrder)],
  });

  const hydratedRails = await Promise.all(
    rails.map(async (rail) => {
      let items: any[] = [];
      const limit = rail.queryConfigJson?.limit || 15;

      if (rail.railType === 'CONTINUE_WATCHING' && user?.id) {
        const progresses = await db
          .select({
            node: mediaNodes,
            pos: watchProgress.positionSeconds,
            dur: watchProgress.durationSeconds,
          })
          .from(watchProgress)
          .innerJoin(mediaNodes, eq(watchProgress.nodeId, mediaNodes.id))
          .where(and(eq(watchProgress.userId, user.id), eq(watchProgress.isCompleted, false)))
          .orderBy(desc(watchProgress.updatedAt))
          .limit(limit);

        items = progresses.map((p) => ({
          ...p.node,
          positionSeconds: p.pos,
          durationSeconds: p.dur,
          progressPercent: p.dur > 0 ? Math.round((p.pos / p.dur) * 100) : 0,
        }));
      } else if (rail.railType === 'HERO_SPOTLIGHT') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']),
          orderBy: [desc(mediaNodes.createdAt)],
          limit: 5,
        });
      } else if (rail.railType === 'RECENTLY_ADDED') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']),
          orderBy: [desc(mediaNodes.createdAt)],
          limit,
        });
      } else if (rail.railType === 'LIVE_TV_GRID') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { eq }) => eq(t.nodeType, 'LIVE_CHANNEL'),
          limit,
        });
      } else if (rail.railType === 'COLLECTIONS_ROW') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { inArray }) => inArray(t.nodeType, ['COLLECTION', 'SHOW']),
          limit,
        });
      } else {
        items = await db.query.mediaNodes.findMany({
          where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']),
          orderBy: [desc(mediaNodes.communityRating)],
          limit,
        });
      }

      const filteredItems = items.filter((item) => isMediaAllowedForUser(user, item));

      return {
        id: rail.id,
        title: rail.title,
        railType: rail.railType,
        cardStyle: rail.cardStyle,
        sortOrder: rail.sortOrder,
        items: filteredItems.map(formatMediaItem),
      };
    })
  );

  return c.json({ rails: hydratedRails });
});

uiRouter.get('/tags', async (c) => {
  const attributes = await db.query.eavAttributes.findMany({
    orderBy: [asc(eavAttributes.displayOrder)],
  });
  return c.json({ attributes });
});
