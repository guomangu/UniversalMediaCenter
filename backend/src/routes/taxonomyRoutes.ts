import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

export const taxonomyRouter = new Hono();

taxonomyRouter.get('/', async (c) => {
  const yearsRes = await db.execute(sql`
    SELECT release_year::text AS label, release_year::text AS slug, COUNT(*)::int AS count
    FROM media_nodes WHERE release_year IS NOT NULL AND (node_type IN ('SHOW', 'COLLECTION') OR parent_id IS NULL)
    GROUP BY release_year ORDER BY release_year DESC LIMIT 40;
  `);

  const genresRes = await db.execute(sql`
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT n.id)::int AS count
    FROM eav_attributes a
    JOIN eav_values v ON v.attribute_id = a.id
    JOIN node_eav_links l ON l.value_id = v.id
    JOIN media_nodes n ON l.node_id = n.id
    WHERE a.code = 'genre' AND (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
    GROUP BY v.value_text, v.value_slug ORDER BY count DESC LIMIT 40;
  `);

  const themesRes = await db.execute(sql`
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT n.id)::int AS count
    FROM eav_attributes a
    JOIN eav_values v ON v.attribute_id = a.id
    JOIN node_eav_links l ON l.value_id = v.id
    JOIN media_nodes n ON l.node_id = n.id
    WHERE a.code IN ('subject', 'studio') AND (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
    GROUP BY v.value_text, v.value_slug ORDER BY count DESC LIMIT 40;
  `);

  return c.json({
    categories: [
      { id: 'years', title: '📅 Années de sortie', tags: Array.from(yearsRes) },
      { id: 'genres', title: '🎭 Genres', tags: Array.from(genresRes) },
      {
        id: 'qualities',
        title: '⭐ Qualité & Résolution',
        tags: [{ label: '1080p', slug: '1080p', count: 18 }, { label: '720p', slug: '720p', count: 3 }],
      },
      { id: 'themes', title: '🏷️ Thèmes & Univers', tags: Array.from(themesRes) },
    ],
  });
});

taxonomyRouter.get('/medias', async (c) => {
  const category = c.req.query('category') || 'years';
  const tag = c.req.query('tag') || '';
  const filter = c.req.query('filter') || '';
  const q = c.req.query('q')?.toLowerCase() || '';
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '15', 10), 1), 100);

  let querySql = sql`
    SELECT DISTINCT n.id, n.title, n.node_type, n.release_year, n.poster_path, n.community_rating
    FROM media_nodes n
    LEFT JOIN node_eav_links l ON l.node_id = n.id
    LEFT JOIN eav_values v ON l.value_id = v.id
    WHERE (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
  `;

  if (category === 'years' && tag) {
    const yr = parseInt(tag, 10);
    if (!isNaN(yr)) querySql = sql`${querySql} AND n.release_year = ${yr}`;
  } else if (category === 'qualities' && tag) {
    const pattern = `%${tag.toLowerCase()}%`;
    querySql = sql`${querySql} AND (n.video_file_path ILIKE ${pattern} OR n.search_vector_text ILIKE ${pattern})`;
  } else if (tag) {
    querySql = sql`${querySql} AND (v.value_slug = ${tag} OR v.value_text ILIKE ${tag})`;
  }

  if (filter && filter !== 'Tous') {
    const filtPattern = `%${filter.toLowerCase()}%`;
    querySql = sql`${querySql} AND (n.video_file_path ILIKE ${filtPattern} OR n.search_vector_text ILIKE ${filtPattern} OR n.node_type::text ILIKE ${filtPattern})`;
  }

  if (q) {
    querySql = sql`${querySql} AND (n.title ILIKE ${'%' + q + '%'} OR n.search_vector_text ILIKE ${'%' + q + '%'} OR v.value_text ILIKE ${'%' + q + '%'})`;
  }

  querySql = sql`${querySql} ORDER BY n.community_rating DESC NULLS LAST, n.release_year DESC NULLS LAST LIMIT ${limit};`;

  const rows = await db.execute(querySql);
  const items = Array.from(rows).map((item: any) => ({
    id: item.id,
    title: item.title,
    nodeType: item.node_type,
    releaseYear: item.release_year,
    posterPath: item.poster_path ? `/api/media/${item.id}/poster` : undefined,
    communityRating: item.community_rating,
  }));

  return c.json({ items, limit, totalReturned: items.length });
});
