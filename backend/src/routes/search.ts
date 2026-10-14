import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

export const searchRouter = new Hono();

searchRouter.get('/', async (c) => {
  const query = c.req.query('q')?.trim();
  if (!query || query.length < 2) {
    return c.json({ query: '', nodes: [], people: [], tags: [] });
  }

  const cleanQuery = query.toLowerCase();

  // 1. Recherche floue sur media_nodes via pg_trgm et similarity
  const nodes = await db.execute(sql`
    SELECT id, node_type, title, original_title, slug, release_year, poster_path,
           similarity(unaccent(search_vector_text), unaccent(${cleanQuery})) AS score
    FROM media_nodes
    WHERE search_vector_text % ${cleanQuery}
       OR word_similarity(unaccent(${cleanQuery}), unaccent(search_vector_text)) > 0.25
       OR title ILIKE ${'%' + cleanQuery + '%'}
    ORDER BY score DESC, release_year DESC NULLS LAST
    LIMIT 20;
  `);

  // 2. Recherche sur les tags cliquables EAV
  const tags = await db.execute(sql`
    SELECT v.id, v.value_text, v.value_slug, a.code AS attribute_code, a.display_name,
           a.ui_zone, a.color_theme,
           similarity(unaccent(v.value_text), unaccent(${cleanQuery})) AS score
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE v.value_text % ${cleanQuery}
       OR v.value_text ILIKE ${'%' + cleanQuery + '%'}
    ORDER BY score DESC
    LIMIT 10;
  `);

  // 3. Recherche spécifique sur les acteurs / personnes
  const people = await db.execute(sql`
    SELECT v.id, v.value_text AS name, v.metadata_json->>'thumbUrl' AS thumb_url,
           a.code AS role_category,
           COUNT(l.id) AS credit_count
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    LEFT JOIN node_eav_links l ON l.value_id = v.id
    WHERE a.code IN ('actor', 'director', 'writer')
      AND (v.value_text % ${cleanQuery} OR v.value_text ILIKE ${'%' + cleanQuery + '%'})
    GROUP BY v.id, v.value_text, v.metadata_json, a.code
    ORDER BY credit_count DESC
    LIMIT 8;
  `);

  return c.json({
    query,
    nodes: Array.from(nodes),
    tags: Array.from(tags),
    people: Array.from(people),
  });
});
