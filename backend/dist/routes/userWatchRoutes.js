import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { watchProgress, mediaNodes } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
export const userWatchRouter = new Hono();
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
userWatchRouter.get('/continue-watching', async (c) => {
    const sessionUser = c.get('user');
    const items = await db
        .select({
        node: mediaNodes,
        pos: watchProgress.positionSeconds,
        dur: watchProgress.durationSeconds,
        updatedAt: watchProgress.updatedAt,
    })
        .from(watchProgress)
        .innerJoin(mediaNodes, eq(watchProgress.nodeId, mediaNodes.id))
        .where(and(eq(watchProgress.userId, sessionUser.id), eq(watchProgress.isCompleted, false)))
        .orderBy(desc(watchProgress.updatedAt))
        .limit(20);
    return c.json({
        items: items.map((it) => ({
            ...formatNode(it.node),
            positionSeconds: it.pos,
            durationSeconds: it.dur,
            progressPercent: it.dur > 0 ? Math.round((it.pos / it.dur) * 100) : 0,
            updatedAt: it.updatedAt,
        })),
    });
});
userWatchRouter.get('/history', async (c) => {
    const sessionUser = c.get('user');
    const items = await db
        .select({
        node: mediaNodes,
        pos: watchProgress.positionSeconds,
        dur: watchProgress.durationSeconds,
        isCompleted: watchProgress.isCompleted,
        updatedAt: watchProgress.updatedAt,
    })
        .from(watchProgress)
        .innerJoin(mediaNodes, eq(watchProgress.nodeId, mediaNodes.id))
        .where(eq(watchProgress.userId, sessionUser.id))
        .orderBy(desc(watchProgress.updatedAt))
        .limit(30);
    return c.json({
        history: items.map((it) => ({
            ...formatNode(it.node),
            positionSeconds: it.pos,
            durationSeconds: it.dur,
            isCompleted: it.isCompleted,
            progressPercent: it.dur > 0 ? Math.round((it.pos / it.dur) * 100) : 0,
            updatedAt: it.updatedAt,
        })),
    });
});
