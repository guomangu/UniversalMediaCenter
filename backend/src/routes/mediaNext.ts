import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { eq, asc, gt, and } from 'drizzle-orm';

export const mediaNextRouter = new Hono();

mediaNextRouter.get('/:id/next', async (c) => {
  const id = c.req.param('id');
  const current = await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });

  if (!current) {
    return c.json({ error: 'Média introuvable' }, 404);
  }

  // 1. Cas d'un épisode de série / anime
  if (current.nodeType === 'EPISODE' && current.parentId) {
    const siblings = await db.query.mediaNodes.findMany({
      where: (t, { eq }) => eq(t.parentId, current.parentId!),
    });

    const currentParsed = parseSeasonEpisode(current.title, current.orderIndex);
    const currentRank = currentParsed?.sortRank ?? current.orderIndex;

    const futureSiblings = siblings
      .filter((s) => s.id !== current.id)
      .map((s) => ({
        node: s,
        rank: parseSeasonEpisode(s.title, s.orderIndex)?.sortRank ?? s.orderIndex,
        info: parseSeasonEpisode(s.title, s.orderIndex),
      }))
      .filter((item) => item.rank > currentRank)
      .sort((a, b) => a.rank - b.rank);

    if (futureSiblings.length > 0) {
      const next = futureSiblings[0].node;
      const info = futureSiblings[0].info;
      return c.json({
        nextNode: {
          id: next.id,
          title: next.title,
          nodeType: next.nodeType,
          orderIndex: next.orderIndex,
          posterPath: next.posterPath ? `/api/media/${next.id}/poster` : `/api/media/${current.id}/poster`,
          runtimeSeconds: next.runtimeSeconds,
          seasonEpisodeTag: info?.seasonEpisodeTag ?? `EP ${next.orderIndex}`,
          displayBadge: info?.displayBadge ?? `EP ${next.orderIndex}`,
        },
      });
    }

    // Si fin de saison, vérifier si le parent est une saison et chercher la suivante
    const parentNode = await db.query.mediaNodes.findFirst({
      where: (t, { eq }) => eq(t.id, current.parentId!),
    });

    if (parentNode?.nodeType === 'SEASON' && parentNode.parentId) {
      const nextSeason = await db.query.mediaNodes.findFirst({
        where: (t, { eq, and, gt }) =>
          and(eq(t.parentId, parentNode.parentId!), eq(t.nodeType, 'SEASON'), gt(t.orderIndex, parentNode.orderIndex)),
        orderBy: (t, { asc }) => [asc(t.orderIndex)],
      });

      if (nextSeason) {
        const firstEp = await db.query.mediaNodes.findFirst({
          where: (t, { eq }) => eq(t.parentId, nextSeason.id),
          orderBy: (t, { asc }) => [asc(t.orderIndex)],
        });

        if (firstEp) {
          const info = parseSeasonEpisode(firstEp.title, firstEp.orderIndex);
          return c.json({
            nextNode: {
              id: firstEp.id,
              title: firstEp.title,
              nodeType: firstEp.nodeType,
              orderIndex: firstEp.orderIndex,
              posterPath: firstEp.posterPath ? `/api/media/${firstEp.id}/poster` : `/api/media/${current.id}/poster`,
              runtimeSeconds: firstEp.runtimeSeconds,
              seasonEpisodeTag: info?.seasonEpisodeTag ?? `EP ${firstEp.orderIndex}`,
              displayBadge: info?.displayBadge ?? `EP ${firstEp.orderIndex}`,
            },
          });
        }
      }
    }
  }

  // 2. Cas d'un film dans une collection / franchise
  if (current.nodeType === 'MOVIE' && current.parentId) {
    const nextMovie = await db.query.mediaNodes.findFirst({
      where: (t, { eq, and, gt }) =>
        and(eq(t.parentId, current.parentId!), eq(t.nodeType, 'MOVIE'), gt(t.orderIndex, current.orderIndex)),
      orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear)],
    });

    if (nextMovie) {
      return c.json({
        nextNode: {
          id: nextMovie.id,
          title: nextMovie.title,
          nodeType: nextMovie.nodeType,
          orderIndex: nextMovie.orderIndex,
          posterPath: nextMovie.posterPath ? `/api/media/${nextMovie.id}/poster` : undefined,
          runtimeSeconds: nextMovie.runtimeSeconds,
          seasonEpisodeTag: null,
          displayBadge: nextMovie.releaseYear ? `${nextMovie.releaseYear}` : 'Suite',
        },
      });
    }
  }

  return c.json({ nextNode: null });
});
