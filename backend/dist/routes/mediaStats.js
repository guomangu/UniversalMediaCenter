import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { sql, desc } from 'drizzle-orm';
export const statsRouter = new Hono();
statsRouter.get('/stats', async (c) => {
    const counts = await db.execute(sql `
    SELECT node_type, COUNT(*)::int as count
    FROM media_nodes
    GROUP BY node_type;
  `);
    const countMap = {};
    for (const r of Array.from(counts)) {
        countMap[r.node_type] = r.count;
    }
    const topGenres = await db.execute(sql `
    SELECT v.value_text as name, COUNT(l.id)::int as count
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    JOIN node_eav_links l ON l.value_id = v.id
    WHERE a.code = 'genre'
    GROUP BY v.value_text
    ORDER BY count DESC
    LIMIT 12;
  `);
    const recentItems = await db.query.mediaNodes.findMany({
        where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']),
        orderBy: [desc(mediaNodes.createdAt)],
        limit: 12,
    });
    const formattedRecent = recentItems.map((item) => ({
        ...item,
        posterPath: item.posterPath ? `/api/media/${item.id}/poster` : undefined,
        fanartPath: item.fanartPath ? `/api/media/${item.id}/fanart` : undefined,
    }));
    return c.json({
        totalMovies: countMap['MOVIE'] || 0,
        totalShows: countMap['SHOW'] || 0,
        totalEpisodes: countMap['EPISODE'] || 0,
        totalLiveChannels: countMap['LIVE_CHANNEL'] || 0,
        totalSeasons: countMap['SEASON'] || 0,
        totalAll: Object.values(countMap).reduce((a, b) => a + b, 0),
        topGenres: Array.from(topGenres),
        recent: formattedRecent,
    });
});
