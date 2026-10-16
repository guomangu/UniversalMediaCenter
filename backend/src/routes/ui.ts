import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, mediaNodes, eavAttributes, watchProgress } from '../db/schema/index.js';
import { desc, asc, eq, and, inArray, sql } from 'drizzle-orm';
import { taxonomyRouter } from './taxonomyRoutes.js';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { localizeMediaNode, extractRequestLanguage } from '../watcher/pipeline/localizationHelper.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';

export const uiRouter = new Hono();

// Taxonomie hiérarchique Catégories < Tags < Médias (accessible publiquement)
uiRouter.route('/taxonomy', taxonomyRouter);

function formatMediaItem(item: any, lang = "fr") {
  const localized = localizeMediaNode(item, lang);
  const nodeType = localized.nodeType || localized.node_type;
  const isEpOrSeason = nodeType === "EPISODE" || nodeType === "SEASON";
  const parsedInfo = isEpOrSeason ? parseSeasonEpisode(localized.title, localized.orderIndex, nodeType) : null;
  return {
    ...localized,
    posterPath: localized.posterPath ? `/api/media/${localized.id}/poster` : undefined,
    fanartPath: localized.fanartPath ? `/api/media/${localized.id}/fanart` : undefined,
    seasonEpisodeTag: parsedInfo?.seasonEpisodeTag ?? null,
    displayBadge: parsedInfo?.displayBadge ?? null,
  };
}

uiRouter.get('/layout', async (c) => {
  const pageTarget = c.req.query('page') || 'HOME';
  const userLang = extractRequestLanguage(c);
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

      // Résolution en batch des chemins physiques pour les conteneurs (SHOW, COLLECTION, SEASON)
      const containerIds = items
        .filter((it) => (it.nodeType === 'SHOW' || it.nodeType === 'COLLECTION' || it.nodeType === 'SEASON') && !it.videoFilePath)
        .map((it) => it.id);

      const containerChildPathsMap = new Map<string, string[]>();
      if (containerIds.length > 0) {
        const childPaths = await db.execute(sql`
          SELECT c.parent_id, c.video_file_path, c.nfo_file_path
          FROM media_nodes c
          WHERE c.parent_id IN (${sql.join(containerIds.map((id: string) => sql`${id}::uuid`), sql`, `)})
             OR c.parent_id IN (
               SELECT s.id FROM media_nodes s 
               WHERE s.parent_id IN (${sql.join(containerIds.map((id: string) => sql`${id}::uuid`), sql`, `)})
             )
        `);
        for (const row of Array.from(childPaths) as any[]) {
          const pid = row.parent_id;
          if (!containerChildPathsMap.has(pid)) containerChildPathsMap.set(pid, []);
          if (row.video_file_path) containerChildPathsMap.get(pid)!.push(row.video_file_path);
          if (row.nfo_file_path) containerChildPathsMap.get(pid)!.push(row.nfo_file_path);
        }
      }

      let filteredItems = items.filter((item) =>
        isMediaAllowedForUser(user, {
          ...item,
          childPaths: containerChildPathsMap.get(item.id) || [],
        })
      );

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
                updatedAt: new Date(),
              } as any);
            }
          }
        }

        filteredItems = filteredItems.map((item) => {
          const prog = pMap.get(item.id);
          if (prog && prog.durationSeconds > 0) {
            return {
              ...item,
              positionSeconds: prog.positionSeconds,
              durationSeconds: prog.durationSeconds,
              progressPercent: Math.round((prog.positionSeconds / prog.durationSeconds) * 100),
              isCompleted: prog.isCompleted,
            };
          }
          return item;
        });
      }

      return {
        id: rail.id,
        title: rail.title,
        railType: rail.railType,
        cardStyle: rail.cardStyle,
        sortOrder: rail.sortOrder,
        items: filteredItems.map((it) => formatMediaItem(it, userLang)),
      };
    })
  );

  return c.json({
    pageTarget,
    rails: hydratedRails,
  });
});
