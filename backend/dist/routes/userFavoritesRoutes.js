import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { userFavorites, mediaNodes } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
export const userFavoritesRouter = new Hono();
function formatNode(node) {
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
    const sessionUser = c.get('user');
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
    return c.json(items.map((i) => ({
        ...formatNode(i.node),
        favoritedAt: i.addedAt,
    })));
});
userFavoritesRouter.post('/favorites/:id', async (c) => {
    const sessionUser = c.get('user');
    const nodeId = c.req.param('id');
    const existing = await db.query.userFavorites.findFirst({
        where: (t, { and: a, eq: e }) => a(e(t.userId, sessionUser.id), e(t.nodeId, nodeId)),
    });
    if (!existing) {
        await db.insert(userFavorites).values({
            userId: sessionUser.id,
            nodeId,
        });
    }
    return c.json({ success: true, favorited: true });
});
userFavoritesRouter.delete('/favorites/:id', async (c) => {
    const sessionUser = c.get('user');
    const nodeId = c.req.param('id');
    await db
        .delete(userFavorites)
        .where(and(eq(userFavorites.userId, sessionUser.id), eq(userFavorites.nodeId, nodeId)));
    return c.json({ success: true, favorited: false });
});
