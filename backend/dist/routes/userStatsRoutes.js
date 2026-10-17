import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { watchProgress, userFavorites, mediaNodes, forumMessages, userFriends, mediaReposts, } from '../db/schema/index.js';
import { eq, and, sql, count, or } from 'drizzle-orm';
import { buildMediaAccessConditions } from '../auth/mediaAccessSql.js';
export const userStatsRouter = new Hono();
userStatsRouter.get('/stats', async (c) => {
    const sessionUser = c.get('user');
    // Stats Médias du catalogue strictement filtrées selon les autorisations de l'utilisateur (PBAC / ABAC / IPTV)
    const accessConds = buildMediaAccessConditions(sessionUser, 'n');
    let accessCondsSql = sql ``;
    for (const cond of accessConds) {
        accessCondsSql = sql `${accessCondsSql} AND ${cond}`;
    }
    const nodeCounts = await db.execute(sql `
    SELECT n.node_type, COUNT(*)::int as total
    FROM media_nodes n
    WHERE n.is_extra = false
      ${accessCondsSql}
    GROUP BY n.node_type;
  `);
    const mediaSummary = { movies: 0, shows: 0, episodes: 0, channels: 0, collections: 0 };
    for (const nc of Array.from(nodeCounts)) {
        if (nc.node_type === 'MOVIE')
            mediaSummary.movies = Number(nc.total);
        if (nc.node_type === 'SHOW')
            mediaSummary.shows = Number(nc.total);
        if (nc.node_type === 'EPISODE')
            mediaSummary.episodes = Number(nc.total);
        if (nc.node_type === 'LIVE_CHANNEL')
            mediaSummary.channels = Number(nc.total);
        if (nc.node_type === 'COLLECTION')
            mediaSummary.collections = Number(nc.total);
    }
    // Stats Personnelles Utilisateur
    const watchStats = await db
        .select({
        totalSeconds: sql `coalesce(sum(${watchProgress.positionSeconds}), 0)`,
        completedCount: sql `count(case when ${watchProgress.isCompleted} = true then 1 end)`,
    })
        .from(watchProgress)
        .where(eq(watchProgress.userId, sessionUser.id));
    const totalWatchHours = Math.round(Number(watchStats[0]?.totalSeconds ?? 0) / 3600);
    const completedCount = Number(watchStats[0]?.completedCount ?? 0);
    const favRes = await db.select({ total: count() }).from(userFavorites).where(eq(userFavorites.userId, sessionUser.id));
    const friendRes = await db
        .select({ total: count() })
        .from(userFriends)
        .where(and(or(eq(userFriends.userId, sessionUser.id), eq(userFriends.friendId, sessionUser.id)), eq(userFriends.status, 'ACCEPTED')));
    const repostRes = await db.select({ total: count() }).from(mediaReposts).where(eq(mediaReposts.userId, sessionUser.id));
    const forumRes = await db
        .select({ total: sql `count(distinct ${forumMessages.topicSlug})` })
        .from(forumMessages)
        .where(eq(forumMessages.authorId, sessionUser.id));
    return c.json({
        userStats: {
            watchHours: totalWatchHours,
            completedMedia: completedCount,
            favoritesCount: Number(favRes[0]?.total ?? 0),
            friendsCount: Number(friendRes[0]?.total ?? 0),
            repostsCount: Number(repostRes[0]?.total ?? 0),
            forumsCount: Number(forumRes[0]?.total ?? 0),
        },
        mediaStats: mediaSummary,
    });
});
