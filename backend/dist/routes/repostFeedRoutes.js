import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaReposts, mediaNodes, users, userFriends } from '../db/schema/index.js';
import { eq, desc, and, or, inArray } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
export const repostFeedRouter = new Hono();
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
repostFeedRouter.get('/user', async (c) => {
    const sessionUser = c.get('user');
    const rows = await db
        .select({ repost: mediaReposts, media: mediaNodes })
        .from(mediaReposts)
        .innerJoin(mediaNodes, eq(mediaReposts.nodeId, mediaNodes.id))
        .where(eq(mediaReposts.userId, sessionUser.id))
        .orderBy(desc(mediaReposts.createdAt))
        .limit(30);
    return c.json({
        reposts: rows.map((r) => ({
            ...r.repost,
            media: formatNode(r.media),
        })),
    });
});
repostFeedRouter.get('/feed', async (c) => {
    const sessionUser = c.get('user');
    const friends = await db
        .select({ userId: userFriends.userId, friendId: userFriends.friendId })
        .from(userFriends)
        .where(and(or(eq(userFriends.userId, sessionUser.id), eq(userFriends.friendId, sessionUser.id)), eq(userFriends.status, 'ACCEPTED')));
    const allowedUserIds = new Set([sessionUser.id]);
    for (const f of friends) {
        if (f.userId === sessionUser.id)
            allowedUserIds.add(f.friendId);
        else
            allowedUserIds.add(f.userId);
    }
    const rows = await db
        .select({
        repost: mediaReposts,
        author: { id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl },
        media: mediaNodes,
    })
        .from(mediaReposts)
        .innerJoin(users, eq(mediaReposts.userId, users.id))
        .innerJoin(mediaNodes, eq(mediaReposts.nodeId, mediaNodes.id))
        .where(inArray(mediaReposts.userId, Array.from(allowedUserIds)))
        .orderBy(desc(mediaReposts.createdAt))
        .limit(50);
    return c.json({
        feed: rows.map((r) => ({
            ...r.repost,
            author: r.author,
            media: formatNode(r.media),
        })),
    });
});
repostFeedRouter.delete('/:id', async (c) => {
    const sessionUser = c.get('user');
    const repostId = c.req.param('id');
    const existing = await db.query.mediaReposts.findFirst({
        where: (t, { eq }) => eq(t.id, repostId),
    });
    if (!existing || existing.userId !== sessionUser.id) {
        return c.json({ error: 'Repost introuvable ou non autorisé' }, 404);
    }
    await db.delete(mediaReposts).where(eq(mediaReposts.id, repostId));
    return c.json({ success: true });
});
