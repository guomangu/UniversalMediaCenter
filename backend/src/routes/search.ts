import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';

export const searchRouter = new Hono();

searchRouter.get('/', async (c) => {
  const query = c.req.query('q')?.trim();
  const user = (c as any).get('user') as any;

  if (!query || query.length < 2) {
    return c.json({ query: '', nodes: [], people: [], tags: [] });
  }

  const cleanQuery = query.toLowerCase();

  // 1. Recherche floue sur media_nodes via pg_trgm et similarity
  const nodes = await db.execute(sql`
    SELECT id, node_type, title, original_title, slug, release_year, poster_path, order_index,
           search_vector_text, video_file_path, nfo_file_path,
           similarity(unaccent(search_vector_text), unaccent(${cleanQuery})) AS score
    FROM media_nodes
    WHERE search_vector_text % ${cleanQuery}
       OR word_similarity(unaccent(${cleanQuery}), unaccent(search_vector_text)) > 0.25
       OR title ILIKE ${'%' + cleanQuery + '%'}
    ORDER BY score DESC, release_year DESC NULLS LAST
    LIMIT 30;
  `);

  const allowedNodes = (Array.from(nodes) as any[]).filter((n) =>
    isMediaAllowedForUser(user, {
      nodeType: n.node_type,
      searchVectorText: n.search_vector_text,
      videoFilePath: n.video_file_path,
      nfoFilePath: n.nfo_file_path,
    })
  );

  const formattedNodes = allowedNodes.map((n) => {
    const isEpOrSeason = n.node_type === 'EPISODE' || n.node_type === 'SEASON';
    const parsedInfo = isEpOrSeason ? parseSeasonEpisode(n.title, n.order_index, n.node_type) : null;
    return {
      id: n.id,
      nodeType: n.node_type,
      title: n.title,
      originalTitle: n.original_title,
      slug: n.slug,
      releaseYear: n.release_year,
      posterPath: n.poster_path ? `/api/media/${n.id}/poster` : undefined,
      seasonEpisodeTag: parsedInfo?.seasonEpisodeTag ?? null,
      displayBadge: parsedInfo?.displayBadge ?? null,
    };
  });

  // 2. Recherche sur les artistes / comédiens / réalisateurs (EAV)
  const people = await db.execute(sql`
    SELECT DISTINCT v.value_text AS name, v.value_slug AS slug, a.display_name AS role,
           similarity(unaccent(v.value_text), unaccent(${cleanQuery})) AS score
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code IN ('actor', 'director', 'writer', 'composer')
      AND (
        v.value_text % ${cleanQuery}
        OR word_similarity(unaccent(${cleanQuery}), unaccent(v.value_text)) > 0.3
        OR v.value_text ILIKE ${'%' + cleanQuery + '%'}
      )
    ORDER BY score DESC
    LIMIT 10;
  `);

  // 3. Recherche sur les autres tags (Genres, Studios, Pays)
  const tags = await db.execute(sql`
    SELECT DISTINCT v.value_text AS label, v.value_slug AS slug, a.code AS type,
           similarity(unaccent(v.value_text), unaccent(${cleanQuery})) AS score
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code IN ('genre', 'studio', 'country')
      AND (
        v.value_text % ${cleanQuery}
        OR word_similarity(unaccent(${cleanQuery}), unaccent(v.value_text)) > 0.3
        OR v.value_text ILIKE ${'%' + cleanQuery + '%'}
      )
    ORDER BY score DESC
    LIMIT 10;
  `);

  return c.json({
    query,
    nodes: formattedNodes,
    people: Array.from(people),
    tags: Array.from(tags),
  });
});
