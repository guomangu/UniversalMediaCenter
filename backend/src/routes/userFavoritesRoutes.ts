import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { userFavorites, mediaNodes } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';

export const userFavoritesRouter = new Hono();

function formatNode(node: any) {
  const nodeType = node.nodeType || node.node_type;
  const isEpOrSeason = nodeType === 'EPISODE' || nodeType === 'SEASON';
  const info = isEpOrSeason ? parseSeasonEpisode(node.title, node.orderIndex, nodeType) : null;
  return {
    ...node,
    posterPath: node.posterPath ? `/api/media/${node.id}/poster` : undefined,
    fanartPath: node.fanartPath ? `/api/media/${node.id}/fanart` : undefined,
    seasonEpisodeTag: info?.seasonEpisodeTag ?? null,
    displayBadge: info?.displayBadge ?? null,
  };
}

userFavoritesRouter.get('/favorites', async (c) => {
  const sessionUser = (c as any).get('user');
  if (!sessionUser) return c.json([]);
  const items = await db
    .select({
      node: mediaNodes,
      addedAt: userFavorites.createdAt,
    })
    .from(userFavorites)
    .innerJoin(mediaNodes, eq(userFavorites.nodeId, mediaNodes.id))
    .where(eq(userFavorites.userId, sessionUser.id))
    .orderBy(desc(userFavorites.createdAt))
    .limit(50);

  return c.json(
    items.map((i) => ({
      ...formatNode(i.node),
      favoritedAt: i.addedAt,
    }))
  );
});

userFavoritesRouter.get('/favorites/check/:id', async (c) => {
  const sessionUser = (c as any).get('user');
  const nodeId = c.req.param('id');
  if (!sessionUser) return c.json({ isFavorite: false });

  const existing = await db.query.userFavorites.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.userId, sessionUser.id), e(t.nodeId, nodeId)),
  });

  return c.json({ isFavorite: Boolean(existing) });
});

userFavoritesRouter.get('/favorites/:id', async (c) => {
  const sessionUser = (c as any).get('user');
  const nodeId = c.req.param('id');
  if (!sessionUser) return c.json({ isFavorite: false });

  const existing = await db.query.userFavorites.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.userId, sessionUser.id), e(t.nodeId, nodeId)),
  });

  return c.json({ isFavorite: Boolean(existing) });
});

userFavoritesRouter.post('/favorites/:id', async (c) => {
  const sessionUser = (c as any).get('user');
  const nodeId = c.req.param('id');
  if (!sessionUser) return c.json({ error: 'Non authentifié' }, 401);

  const existing = await db.query.userFavorites.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.userId, sessionUser.id), e(t.nodeId, nodeId)),
  });

  if (!existing) {
    await db.insert(userFavorites).values({
      userId: sessionUser.id,
      nodeId,
    });
  }

  return c.json({ success: true, isFavorite: true, favorited: true });
});

userFavoritesRouter.delete('/favorites/:id', async (c) => {
  const sessionUser = (c as any).get('user');
  const nodeId = c.req.param('id');
  if (!sessionUser) return c.json({ error: 'Non authentifié' }, 401);

  await db
    .delete(userFavorites)
    .where(and(eq(userFavorites.userId, sessionUser.id), eq(userFavorites.nodeId, nodeId)));

  return c.json({ success: true, isFavorite: false, favorited: false });
});
