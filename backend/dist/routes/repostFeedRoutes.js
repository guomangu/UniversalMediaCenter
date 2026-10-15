import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaReposts, mediaNodes, users, userFriends } from '../db/schema/index.js';
import { eq, desc, and, or, inArray } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
export const repostFeedRouter = new Hono();
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
repostFeedRouter.get('/user', async (c) => {
    const sessionUser = c.get('user');
    const items = await db
        .select({
        id: mediaReposts.id,
        nodeId: mediaReposts.nodeId,
        comment: mediaReposts.comment,
        createdAt: mediaReposts.createdAt,
        node: mediaNodes,
    })
        .from(mediaReposts)
        .innerJoin(mediaNodes, eq(mediaReposts.nodeId, mediaNodes.id))
        .where(eq(mediaReposts.userId, sessionUser.id))
        .orderBy(desc(mediaReposts.createdAt))
        .limit(30);
    return c.json(items.map((it) => ({
        ...it,
        node: formatNode(it.node),
    })));
});
repostFeedRouter.get('/friends', async (c) => {
    const sessionUser = c.get('user');
    const friends = await db
        .select({ friendId: userFriends.friendId })
        .from(userFriends)
        .where(and(eq(userFriends.userId, sessionUser.id), eq(userFriends.status, 'ACCEPTED')));
    const friendIds = friends.map((f) => f.friendId);
    if (friendIds.length === 0) {
        return c.json([]);
    }
    const items = await db
        .select({
        id: mediaReposts.id,
        nodeId: mediaReposts.nodeId,
        comment: mediaReposts.comment,
        createdAt: mediaReposts.createdAt,
        node: mediaNodes,
        user: {
            id: users.id,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        },
    })
        .from(mediaReposts)
        .innerJoin(mediaNodes, eq(mediaReposts.nodeId, mediaNodes.id))
        .innerJoin(users, eq(mediaReposts.userId, users.id))
        .where(inArray(mediaReposts.userId, friendIds))
        .orderBy(desc(mediaReposts.createdAt))
        .limit(30);
    return c.json(items.map((it) => ({
        ...it,
        node: formatNode(it.node),
    })));
});
repostFeedRouter.post('/', async (c) => {
    const sessionUser = c.get('user');
    const body = await c.req.json();
    const { nodeId, comment } = body;
    if (!nodeId) {
        return c.json({ error: 'nodeId manquant' }, 400);
    }
    const [inserted] = await db
        .insert(mediaReposts)
        .values({
        userId: sessionUser.id,
        nodeId,
        comment: comment || null,
    })
        .returning();
    return c.json(inserted);
});
