import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { watchProgress, mediaNodes } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
export const userWatchRouter = new Hono();
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
userWatchRouter.get('/continue-watching', async (c) => {
    const sessionUser = c.get('user');
    const items = await db
        .select({
        node: mediaNodes,
        pos: watchProgress.positionSeconds,
        dur: watchProgress.durationSeconds,
        isCompleted: watchProgress.isCompleted,
    })
        .from(watchProgress)
        .innerJoin(mediaNodes, eq(watchProgress.nodeId, mediaNodes.id))
        .where(and(eq(watchProgress.userId, sessionUser.id), eq(watchProgress.isCompleted, false)))
        .orderBy(desc(watchProgress.updatedAt))
        .limit(20);
    return c.json(items.map((i) => ({
        ...formatNode(i.node),
        positionSeconds: i.pos,
        durationSeconds: i.dur,
        progressPercent: i.dur > 0 ? Math.round((i.pos / i.dur) * 100) : 0,
        isCompleted: i.isCompleted,
    })));
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
        .limit(50);
    return c.json(items.map((i) => ({
        ...formatNode(i.node),
        positionSeconds: i.pos,
        durationSeconds: i.dur,
        progressPercent: i.dur > 0 ? Math.round((i.pos / i.dur) * 100) : 0,
        isCompleted: i.isCompleted,
        watchedAt: i.updatedAt,
    })));
});
