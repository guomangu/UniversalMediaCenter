import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, mediaNodes, eavAttributes, watchProgress } from '../db/schema/index.js';
import { desc, asc, eq, and, inArray } from 'drizzle-orm';
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
            isCompleted: watchProgress.isCompleted,
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
          isCompleted: p.isCompleted,
        }));
      } else if (rail.railType === 'HERO_SPOTLIGHT') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { and, inArray, eq }) =>
            and(inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']), eq(t.isExtra, false)),
          orderBy: [desc(mediaNodes.createdAt)],
          limit: 5,
        });
      } else if (rail.railType === 'RECENTLY_ADDED') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { and, inArray, eq }) =>
            and(inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']), eq(t.isExtra, false)),
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
          where: (t, { and, inArray, eq }) =>
            and(inArray(t.nodeType, ['COLLECTION', 'SHOW']), eq(t.isExtra, false)),
          limit,
        });
      } else {
        items = await db.query.mediaNodes.findMany({
          where: (t, { and, inArray, eq }) =>
            and(inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']), eq(t.isExtra, false)),
          orderBy: [desc(mediaNodes.communityRating)],
          limit,
        });
      }

      let filteredItems = items.filter((item) => isMediaAllowedForUser(user, item));

      // Hydratation de la progression de lecture de l'utilisateur pour tous les rails
      if (user?.id && filteredItems.length > 0) {
        const itemIds = filteredItems.map((it) => it.id);
        const progresses = await db.query.watchProgress.findMany({
          where: (t, { and, eq, inArray }) => and(eq(t.userId, user.id), inArray(t.nodeId, itemIds)),
        });
        const pMap = new Map(progresses.map((p) => [p.nodeId, p]));

        // Pour les séries, saisons et collections de films, vérifier si des épisodes/films enfants ont une progression
        const showIds = filteredItems
          .filter((it) => it.nodeType === 'SHOW' || it.nodeType === 'SEASON' || it.nodeType === 'COLLECTION')
          .map((it) => it.id);

        if (showIds.length > 0) {
          const childProgresses = await db
            .select({
              parentId: mediaNodes.parentId,
              pos: watchProgress.positionSeconds,
              dur: watchProgress.durationSeconds,
              isCompleted: watchProgress.isCompleted,
            })
            .from(watchProgress)
            .innerJoin(mediaNodes, eq(watchProgress.nodeId, mediaNodes.id))
            .where(
              and(
                eq(watchProgress.userId, user.id),
                inArray(mediaNodes.parentId, showIds),
                eq(watchProgress.isCompleted, false)
              )
            )
            .orderBy(desc(watchProgress.updatedAt));

          for (const cp of childProgresses) {
            if (cp.parentId && !pMap.has(cp.parentId) && cp.dur > 0 && cp.pos > 0) {
              pMap.set(cp.parentId, {
                nodeId: cp.parentId,
                positionSeconds: cp.pos,
                durationSeconds: cp.dur,
                isCompleted: cp.isCompleted,
              } as any);
            }
          }
        }

        filteredItems = filteredItems.map((it) => {
          const p = pMap.get(it.id);
          const dur = p?.durationSeconds || it.durationSeconds || it.runtimeSeconds || 0;
          const pos = p?.positionSeconds || it.positionSeconds || 0;
          const progressPercent = dur > 0 ? Math.round((pos / dur) * 100) : (p?.isCompleted ? 100 : (it.progressPercent || 0));
          return {
            ...it,
            positionSeconds: pos,
            durationSeconds: dur,
            progressPercent,
            isCompleted: p?.isCompleted ?? it.isCompleted ?? false,
          };
        });
      }

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

  return c.json(hydratedRails);
});
