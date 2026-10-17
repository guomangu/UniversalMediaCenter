import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';
import { buildMediaAccessConditions } from '../auth/mediaAccessSql.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';
export const statsRouter = new Hono();
statsRouter.get('/stats', async (c) => {
    const user = c.get('user');
    const accessConds = buildMediaAccessConditions(user, 'n');
    let accessCondsSql = sql ``;
    for (const cond of accessConds) {
        accessCondsSql = sql `${accessCondsSql} AND ${cond}`;
    }
    // 1. Comptages par type de média avec respect des accès utilisateur
    const counts = await db.execute(sql `
    SELECT n.node_type, COUNT(*)::int as count
    FROM media_nodes n
    WHERE n.is_extra = false
      ${accessCondsSql}
    GROUP BY n.node_type;
  `);
    const countMap = {};
    for (const r of Array.from(counts)) {
        countMap[r.node_type] = r.count;
    }
    // 2. Top genres accessibles
    const topGenres = await db.execute(sql `
    SELECT v.value_text as name, COUNT(DISTINCT n.id)::int as count
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    JOIN node_eav_links l ON l.value_id = v.id
    JOIN media_nodes n ON l.node_id = n.id
    WHERE a.code = 'genre'
      AND n.is_extra = false
      ${accessCondsSql}
    GROUP BY v.value_text
    HAVING COUNT(DISTINCT n.id) > 0
    ORDER BY count DESC
    LIMIT 12;
  `);
    // 3. Derniers ajouts sécurisés (filtrage strict amont SQL et mémoire JS)
    const recentRows = await db.execute(sql `
    SELECT n.id, n.title, n.node_type, n.release_year, n.poster_path, n.fanart_path,
           n.video_file_path, n.nfo_file_path, n.search_vector_text,
           COALESCE(
             n.video_file_path,
             n.nfo_file_path,
             (SELECT c.video_file_path FROM media_nodes c WHERE (c.parent_id = n.id OR c.parent_id IN (SELECT id FROM media_nodes WHERE parent_id = n.id)) AND c.video_file_path IS NOT NULL LIMIT 1)
           ) AS effective_physical_path
    FROM media_nodes n
    WHERE n.is_extra = false
      AND n.node_type IN ('MOVIE', 'SHOW', 'EPISODE')
      ${accessCondsSql}
    ORDER BY n.created_at DESC
    LIMIT 30;
  `);
    const allowedRecent = Array.from(recentRows)
        .filter((row) => isMediaAllowedForUser(user, {
        title: row.title,
        nodeType: row.node_type,
        videoFilePath: row.video_file_path,
        nfoFilePath: row.nfo_file_path,
        effectivePhysicalPath: row.effective_physical_path,
        searchVectorText: row.search_vector_text,
    }))
        .slice(0, 12);
    const formattedRecent = allowedRecent.map((item) => ({
        ...item,
        posterPath: item.poster_path ? `/api/media/${item.id}/poster` : undefined,
        fanartPath: item.fanart_path ? `/api/media/${item.id}/fanart` : undefined,
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
