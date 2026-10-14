import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
export const taxonomyRouter = new Hono();
taxonomyRouter.get('/', async (c) => {
    const yearsRes = await db.execute(sql `
    SELECT yr::text AS label, yr::text AS slug, COUNT(DISTINCT media_id)::int AS count FROM (
      SELECT release_year AS yr, id AS media_id FROM media_nodes WHERE release_year IS NOT NULL AND (node_type IN ('SHOW', 'COLLECTION') OR parent_id IS NULL)
      UNION ALL
      SELECT c.release_year AS yr, c.parent_id AS media_id FROM media_nodes c WHERE c.parent_id IS NOT NULL AND c.release_year IS NOT NULL
    ) y GROUP BY yr ORDER BY count DESC, yr DESC LIMIT 40;
  `);
    const genresRes = await db.execute(sql `
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT target_id)::int AS count FROM (
      SELECT l.value_id, n.id AS target_id FROM node_eav_links l JOIN media_nodes n ON l.node_id = n.id WHERE (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
      UNION
      SELECT cl.value_id, c.parent_id AS target_id FROM node_eav_links cl JOIN media_nodes c ON cl.node_id = c.id WHERE c.parent_id IS NOT NULL
    ) links JOIN eav_values v ON links.value_id = v.id JOIN eav_attributes a ON v.attribute_id = a.id WHERE a.code = 'genre' GROUP BY v.value_text, v.value_slug ORDER BY count DESC LIMIT 40;
  `);
    const themesRes = await db.execute(sql `
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT target_id)::int AS count FROM (
      SELECT l.value_id, n.id AS target_id FROM node_eav_links l JOIN media_nodes n ON l.node_id = n.id WHERE (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
      UNION
      SELECT cl.value_id, c.parent_id AS target_id FROM node_eav_links cl JOIN media_nodes c ON cl.node_id = c.id WHERE c.parent_id IS NOT NULL
    ) links JOIN eav_values v ON links.value_id = v.id JOIN eav_attributes a ON v.attribute_id = a.id WHERE a.code IN ('subject', 'studio') GROUP BY v.value_text, v.value_slug ORDER BY count DESC LIMIT 40;
  `);
    const qualitiesRes = await db.execute(sql `
    SELECT q.label, q.slug, COUNT(DISTINCT target_id)::int AS count FROM (\n      SELECT '1080p' AS label, '1080p' AS slug, COALESCE(parent_id, id) AS target_id FROM media_nodes WHERE video_file_path ILIKE '%1080p%' OR search_vector_text ILIKE '%1080p%'\n      UNION\n      SELECT '720p' AS label, '720p' AS slug, COALESCE(parent_id, id) AS target_id FROM media_nodes WHERE video_file_path ILIKE '%720p%' OR search_vector_text ILIKE '%720p%'\n    ) q GROUP BY q.label, q.slug ORDER BY count DESC;\n  `);
    return c.json({
        categories: [
            { id: 'genres', title: '🎭 Genres', tags: Array.from(genresRes) },
            { id: 'years', title: '📅 Années de sortie', tags: Array.from(yearsRes) },
            { id: 'qualities', title: '⭐ Qualité & Résolution', tags: Array.from(qualitiesRes) },
            { id: 'themes', title: '🏷️ Thèmes & Univers', tags: Array.from(themesRes) },
        ],
    });
});
taxonomyRouter.get('/medias', async (c) => {
    const category = c.req.query('category') || 'genres';
    const tag = c.req.query('tag') || '';
    const filter = c.req.query('filter') || '';
    const q = c.req.query('q')?.toLowerCase() || '';
    const excludeIdsParam = c.req.query('excludeIds') || '';
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '15', 10), 1), 100);
    let querySql = sql `
    SELECT DISTINCT n.id, n.title, n.node_type, n.release_year, n.poster_path, n.community_rating
    FROM media_nodes n LEFT JOIN node_eav_links l ON l.node_id = n.id LEFT JOIN eav_values v ON l.value_id = v.id
    WHERE (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
  `;
    if (excludeIdsParam) {
        const rawIds = excludeIdsParam.split(',').map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
        if (rawIds.length > 0) {
            querySql = sql `${querySql} AND n.id NOT IN (${sql.join(rawIds.map((id) => sql `${id}::uuid`), sql `, `)})`;
        }
    }
    if (category === 'years' && tag) {
        const yr = parseInt(tag, 10);
        if (!isNaN(yr))
            querySql = sql `${querySql} AND (n.release_year = ${yr} OR n.id IN (SELECT parent_id FROM media_nodes WHERE parent_id IS NOT NULL AND release_year = ${yr}))`;
    }
    else if (category === 'qualities' && tag) {
        const p = `%${tag.toLowerCase()}%`;
        querySql = sql `${querySql} AND (n.video_file_path ILIKE ${p} OR n.search_vector_text ILIKE ${p} OR n.id IN (SELECT parent_id FROM media_nodes WHERE parent_id IS NOT NULL AND (video_file_path ILIKE ${p} OR search_vector_text ILIKE ${p})))`;
    }
    else if (tag) {
        querySql = sql `${querySql} AND (v.value_slug = ${tag} OR v.value_text ILIKE ${tag} OR n.id IN (SELECT c.parent_id FROM media_nodes c JOIN node_eav_links cl ON cl.node_id = c.id JOIN eav_values cv ON cl.value_id = cv.id WHERE c.parent_id IS NOT NULL AND (cv.value_slug = ${tag} OR cv.value_text ILIKE ${tag})))`;
    }
    if (filter && filter !== 'Tous') {
        const fp = `%${filter.toLowerCase()}%`;
        querySql = sql `${querySql} AND (n.video_file_path ILIKE ${fp} OR n.search_vector_text ILIKE ${fp} OR n.node_type::text ILIKE ${fp} OR n.id IN (SELECT parent_id FROM media_nodes WHERE parent_id IS NOT NULL AND (video_file_path ILIKE ${fp} OR search_vector_text ILIKE ${fp} OR node_type::text ILIKE ${fp})))`;
    }
    if (q) {
        querySql = sql `${querySql} AND (n.title ILIKE ${'%' + q + '%'} OR n.search_vector_text ILIKE ${'%' + q + '%'} OR v.value_text ILIKE ${'%' + q + '%'})`;
    }
    const fetchLimit = limit + 1;
    querySql = sql `${querySql} ORDER BY n.community_rating DESC NULLS LAST, n.release_year DESC NULLS LAST LIMIT ${fetchLimit};`;
    const rows = await db.execute(querySql);
    const rawItems = Array.from(rows);
    const hasMore = rawItems.length > limit;
    const sliced = hasMore ? rawItems.slice(0, limit) : rawItems;
    const items = sliced.map((item) => ({
        id: item.id, title: item.title, nodeType: item.node_type, releaseYear: item.release_year,
        posterPath: item.poster_path ? `/api/media/${item.id}/poster` : undefined, communityRating: item.community_rating,
    }));
    return c.json({ items, limit, hasMore, totalReturned: items.length });
});
