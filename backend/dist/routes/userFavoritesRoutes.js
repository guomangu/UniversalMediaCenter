import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { userFavorites, mediaNodes } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
export const userFavoritesRouter = new Hono();
function formatNode(node) {
    const info = parseSeasonEpisode(node.title, node.orderIndex);
    return {
        ...node,
        posterPath: node.posterPath ? `/api/media/${node.id}/poster` : undefined,
        fanartPath: node.fanartPath ? `/api/media/${node.id}/fanart` : undefined,
        seasonEpisodeTag: info?.seasonEpisodeTag ?? null,
        displayBadge: info?.displayBadge ?? null,
    };
}
userFavoritesRouter.get('/favorites', async (c) => {
    const sessionUser = c.get('user');
    const favs = await db
        .select({ node: mediaNodes, createdAt: userFavorites.createdAt })
        .from(userFavorites)
        .innerJoin(mediaNodes, eq(userFavorites.nodeId, mediaNodes.id))
        .where(eq(userFavorites.userId, sessionUser.id))
        .orderBy(desc(userFavorites.createdAt))
        .limit(50);
    return c.json({
        favorites: favs.map((f) => ({
            ...formatNode(f.node),
            favoritedAt: f.createdAt,
        })),
    });
});
userFavoritesRouter.post('/favorites/:nodeId', async (c) => {
    const sessionUser = c.get('user');
    const nodeId = c.req.param('nodeId');
    await db
        .insert(userFavorites)
        .values({ userId: sessionUser.id, nodeId })
        .onConflictDoNothing();
    return c.json({ success: true, isFavorite: true });
});
userFavoritesRouter.delete('/favorites/:nodeId', async (c) => {
    const sessionUser = c.get('user');
    const nodeId = c.req.param('nodeId');
    await db
        .delete(userFavorites)
        .where(and(eq(userFavorites.userId, sessionUser.id), eq(userFavorites.nodeId, nodeId)));
    return c.json({ success: true, isFavorite: false });
});
userFavoritesRouter.get('/favorites/check/:nodeId', async (c) => {
    const sessionUser = c.get('user');
    const nodeId = c.req.param('nodeId');
    const fav = await db.query.userFavorites.findFirst({
        where: (t, { eq, and }) => and(eq(t.userId, sessionUser.id), eq(t.nodeId, nodeId)),
    });
    return c.json({ isFavorite: Boolean(fav) });
});
