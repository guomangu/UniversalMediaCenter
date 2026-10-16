import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

export const taxonomyRouter = new Hono();

taxonomyRouter.get('/', async (c) => {
  // 1. Sagas & Collections
  const sagasRes = await db.execute(sql`
    SELECT n.title AS label, COALESCE(n.slug, n.id::text) AS slug, COUNT(c.id)::int AS count
    FROM media_nodes n
    JOIN media_nodes c ON c.parent_id = n.id
    WHERE n.node_type = 'COLLECTION'
    GROUP BY n.id, n.title, n.slug
    ORDER BY count DESC, n.title ASC
    LIMIT 50;
  `);

  // 2. Séries par Genre
  const seriesRes = await db.execute(sql`
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT target_id)::int AS count
    FROM (
      SELECT l.value_id, n.id AS target_id
      FROM node_eav_links l
      JOIN media_nodes n ON l.node_id = n.id
      WHERE n.node_type = 'SHOW'
      UNION
      SELECT cl.value_id, c.parent_id AS target_id
      FROM node_eav_links cl
      JOIN media_nodes c ON cl.node_id = c.id
      JOIN media_nodes p ON c.parent_id = p.id
      WHERE p.node_type = 'SHOW'
    ) links
    JOIN eav_values v ON links.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code = 'genre'
    GROUP BY v.value_text, v.value_slug
    ORDER BY count DESC, v.value_text ASC
    LIMIT 40;
  `);

  // 3. Films par Genre (Placé juste au-dessus de Studios, ordonné par genre et n'affichant que des films)
  const moviesRes = await db.execute(sql`
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT target_id)::int AS count
    FROM (
      SELECT l.value_id, n.id AS target_id
      FROM node_eav_links l
      JOIN media_nodes n ON l.node_id = n.id
      WHERE n.node_type = 'MOVIE'
    ) links
    JOIN eav_values v ON links.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code = 'genre'
    GROUP BY v.value_text, v.value_slug
    ORDER BY count DESC, v.value_text ASC
    LIMIT 40;
  `);

  // 4. Studios de Production
  const studiosRes = await db.execute(sql`
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT target_id)::int AS count FROM (
      SELECT l.value_id, n.id AS target_id FROM node_eav_links l JOIN media_nodes n ON l.node_id = n.id WHERE n.node_type IN ('SHOW', 'COLLECTION', 'MOVIE')
      UNION
      SELECT cl.value_id, c.parent_id AS target_id FROM node_eav_links cl JOIN media_nodes c ON cl.node_id = c.id WHERE c.parent_id IS NOT NULL
    ) links JOIN eav_values v ON links.value_id = v.id JOIN eav_attributes a ON v.attribute_id = a.id WHERE a.code = 'studio' AND v.value_text !~ '^[0-9]+$' GROUP BY v.value_text, v.value_slug ORDER BY count DESC LIMIT 40;
  `);

  // 5. Réalisateurs
  const directorsRes = await db.execute(sql`
    SELECT v.value_text AS label, v.value_slug AS slug, COUNT(DISTINCT target_id)::int AS count FROM (
      SELECT l.value_id, n.id AS target_id FROM node_eav_links l JOIN media_nodes n ON l.node_id = n.id WHERE n.node_type IN ('SHOW', 'COLLECTION', 'MOVIE')
      UNION
      SELECT cl.value_id, c.parent_id AS target_id FROM node_eav_links cl JOIN media_nodes c ON cl.node_id = c.id WHERE c.parent_id IS NOT NULL
    ) links JOIN eav_values v ON links.value_id = v.id JOIN eav_attributes a ON v.attribute_id = a.id WHERE a.code = 'director' AND v.value_text !~ '^[0-9]+$' GROUP BY v.value_text, v.value_slug ORDER BY count DESC LIMIT 40;
  `);

  // 6. Qualité & Résolution (Extraction Dynamique Universelle O(1))
  const qualitiesRes = await db.execute(sql`
    WITH raw_qualities AS (
      -- 1. Attributs EAV de qualité vidéo
      SELECT 
        CASE 
          WHEN v.value_text ~* '(?i)\\y(4k|2160p)\\y' OR v.value_slug IN ('4k', '4k-uhd', '2160p') THEN '4K UHD'
          WHEN v.value_text ~* '(?i)\\y(1080p|1080)\\y' OR v.value_slug ILIKE '%1080%' THEN '1080p FHD'
          WHEN v.value_text ~* '(?i)\\y(720p|720)\\y' OR v.value_slug ILIKE '%720%' THEN '720p HD'
          WHEN v.value_text ~* '(?i)\\y(576p|576)\\y' OR v.value_slug ILIKE '%576%' THEN '576p'
          WHEN v.value_text ~* '(?i)\\y(480p|480|sd)\\y' OR v.value_slug IN ('480p', '480p-sd', 'sd') THEN '480p SD'
          WHEN v.value_text ~* '(?i)\\y(360p|360)\\y' OR v.value_slug ILIKE '%360%' THEN '360p'
          ELSE NULL
        END AS label,
        CASE 
          WHEN v.value_text ~* '(?i)\\y(4k|2160p)\\y' OR v.value_slug IN ('4k', '4k-uhd', '2160p') THEN '4k'
          WHEN v.value_text ~* '(?i)\\y(1080p|1080)\\y' OR v.value_slug ILIKE '%1080%' THEN '1080p'
          WHEN v.value_text ~* '(?i)\\y(720p|720)\\y' OR v.value_slug ILIKE '%720%' THEN '720p'
          WHEN v.value_text ~* '(?i)\\y(576p|576)\\y' OR v.value_slug ILIKE '%576%' THEN '576p'
          WHEN v.value_text ~* '(?i)\\y(480p|480|sd)\\y' OR v.value_slug IN ('480p', '480p-sd', 'sd') THEN '480p'
          WHEN v.value_text ~* '(?i)\\y(360p|360)\\y' OR v.value_slug ILIKE '%360%' THEN '360p'
          ELSE NULL
        END AS slug,
        COALESCE(n.parent_id, n.id) AS target_id
      FROM node_eav_links l
      JOIN media_nodes n ON l.node_id = n.id
      JOIN eav_values v ON l.value_id = v.id
      JOIN eav_attributes a ON v.attribute_id = a.id
      WHERE a.code IN ('video_quality', 'quality', 'resolution')

      UNION ALL

      -- 2. Détection Regex dans le chemin de fichier vidéo
      SELECT
        CASE 
          WHEN n.video_file_path ~* '(?i)\\y(4k|2160p)\\y' THEN '4K UHD'
          WHEN n.video_file_path ~* '(?i)\\y1080p\\y' THEN '1080p FHD'
          WHEN n.video_file_path ~* '(?i)\\y720p\\y' THEN '720p HD'
          WHEN n.video_file_path ~* '(?i)\\y576p\\y' THEN '576p'
          WHEN n.video_file_path ~* '(?i)\\y480p\\y' THEN '480p SD'
          WHEN n.video_file_path ~* '(?i)\\y360p\\y' THEN '360p'
          ELSE NULL
        END AS label,
        CASE 
          WHEN n.video_file_path ~* '(?i)\\y(4k|2160p)\\y' THEN '4k'
          WHEN n.video_file_path ~* '(?i)\\y1080p\\y' THEN '1080p'
          WHEN n.video_file_path ~* '(?i)\\y720p\\y' THEN '720p'
          WHEN n.video_file_path ~* '(?i)\\y576p\\y' THEN '576p'
          WHEN n.video_file_path ~* '(?i)\\y480p\\y' THEN '480p'
          WHEN n.video_file_path ~* '(?i)\\y360p\\y' THEN '360p'
          ELSE NULL
        END AS slug,
        COALESCE(n.parent_id, n.id) AS target_id
      FROM media_nodes n
      WHERE n.video_file_path IS NOT NULL
    )
    SELECT label, slug, COUNT(DISTINCT target_id)::int AS count
    FROM raw_qualities
    WHERE label IS NOT NULL
    GROUP BY label, slug
    ORDER BY 
      CASE slug
        WHEN '4k' THEN 1
        WHEN '1080p' THEN 2
        WHEN '720p' THEN 3
        WHEN '576p' THEN 4
        WHEN '480p' THEN 5
        WHEN '360p' THEN 6
        ELSE 7
      END ASC;
  `);

  // 7. Pays d'Origine (Remplacement de Thème par Pays)
  const countriesRes = await db.execute(sql`
    SELECT 
      CASE 
        WHEN v.value_text IN ('United States of America', 'US', 'USA') THEN 'États-Unis'
        WHEN v.value_text IN ('France', 'FR') THEN 'France'
        WHEN v.value_text IN ('United Kingdom', 'GB', 'UK') THEN 'Royaume-Uni'
        WHEN v.value_text IN ('Japan', 'JP') THEN 'Japon'
        WHEN v.value_text IN ('Canada', 'CA') THEN 'Canada'
        WHEN v.value_text IN ('Germany', 'DE') THEN 'Allemagne'
        WHEN v.value_text IN ('Belgium', 'BE') THEN 'Belgique'
        WHEN v.value_text IN ('Italy', 'IT') THEN 'Italie'
        WHEN v.value_text IN ('South Korea', 'KR') THEN 'Corée du Sud'
        WHEN v.value_text IN ('Spain', 'ES') THEN 'Espagne'
        WHEN v.value_text IN ('Switzerland', 'CH') THEN 'Suisse'
        WHEN v.value_text IN ('New Zealand', 'NZ') THEN 'Nouvelle-Zélande'
        WHEN v.value_text IN ('Australia', 'AU') THEN 'Australie'
        ELSE v.value_text
      END AS label,
      LOWER(CASE 
        WHEN v.value_text IN ('United States of America', 'US', 'USA') THEN 'etats-unis'
        WHEN v.value_text IN ('France', 'FR') THEN 'france'
        WHEN v.value_text IN ('United Kingdom', 'GB', 'UK') THEN 'royaume-uni'
        WHEN v.value_text IN ('Japan', 'JP') THEN 'japon'
        WHEN v.value_text IN ('Canada', 'CA') THEN 'canada'
        WHEN v.value_text IN ('Germany', 'DE') THEN 'allemagne'
        WHEN v.value_text IN ('Belgium', 'BE') THEN 'belgique'
        WHEN v.value_text IN ('Italy', 'IT') THEN 'italie'
        WHEN v.value_text IN ('South Korea', 'KR') THEN 'coree-du-sud'
        WHEN v.value_text IN ('Spain', 'ES') THEN 'espagne'
        WHEN v.value_text IN ('Switzerland', 'CH') THEN 'suisse'
        WHEN v.value_text IN ('New Zealand', 'NZ') THEN 'nouvelle-zelande'
        WHEN v.value_text IN ('Australia', 'AU') THEN 'australie'
        ELSE v.value_slug
      END) AS slug,
      COUNT(DISTINCT target_id)::int AS count
    FROM (
      SELECT l.value_id, n.id AS target_id FROM node_eav_links l JOIN media_nodes n ON l.node_id = n.id WHERE n.node_type IN ('SHOW', 'COLLECTION', 'MOVIE')
      UNION
      SELECT cl.value_id, c.parent_id AS target_id FROM node_eav_links cl JOIN media_nodes c ON cl.node_id = c.id WHERE c.parent_id IS NOT NULL
    ) links
    JOIN eav_values v ON links.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code = 'country'
    GROUP BY 1, 2
    ORDER BY count DESC
    LIMIT 40;
  `);

  return c.json({
    categories: [
      { id: 'sagas', title: 'Sagas', tags: Array.from(sagasRes) },
      { id: 'series', title: 'Séries', tags: Array.from(seriesRes) },
      { id: 'movies', title: 'Films', tags: Array.from(moviesRes) },
      { id: 'studios', title: 'Studios', tags: Array.from(studiosRes) },
      { id: 'directors', title: 'Réalisateur', tags: Array.from(directorsRes) },
      { id: 'qualities', title: 'Qualité', tags: Array.from(qualitiesRes) },
      { id: 'countries', title: 'Pays', tags: Array.from(countriesRes) },
    ],
  });
});

taxonomyRouter.get('/medias', async (c) => {
  const category = c.req.query('category') || 'sagas';
  const tag = c.req.query('tag') || '';
  const filter = c.req.query('filter') || '';
  const q = c.req.query('q')?.toLowerCase() || '';
  const excludeIdsParam = c.req.query('excludeIds') || '';
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '15', 10), 1), 100);

  let querySql = sql`
    SELECT DISTINCT n.id, n.title, n.node_type, n.release_year, n.poster_path, n.community_rating, n.order_index
    FROM media_nodes n 
    LEFT JOIN node_eav_links l ON l.node_id = n.id 
    LEFT JOIN eav_values v ON l.value_id = v.id
    LEFT JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE n.is_extra = false
  `;

  if (category === 'sagas') {
    if (tag) {
      querySql = sql`${querySql} AND (\n        (n.node_type = 'COLLECTION' AND (n.slug = ${tag} OR n.title ILIKE ${tag} OR n.id::text = ${tag}))
        OR n.parent_id IN (SELECT id FROM media_nodes WHERE node_type = 'COLLECTION' AND (slug = ${tag} OR title ILIKE ${tag} OR id::text = ${tag}))
      )`;
    } else {
      querySql = sql`${querySql} AND n.node_type = 'COLLECTION'`;
    }
  } else if (category === 'series') {
    querySql = sql`${querySql} AND n.node_type = 'SHOW'`;
    if (tag) {
      querySql = sql`${querySql} AND (
        ((v.value_slug = ${tag} OR v.value_text ILIKE ${tag}) AND a.code = 'genre')
        OR n.id IN (
          SELECT c.parent_id FROM media_nodes c 
          JOIN node_eav_links cl ON cl.node_id = c.id 
          JOIN eav_values cv ON cl.value_id = cv.id 
          JOIN eav_attributes ca ON cv.attribute_id = ca.id 
          WHERE c.parent_id IS NOT NULL AND ca.code = 'genre' AND (cv.value_slug = ${tag} OR cv.value_text ILIKE ${tag})
        )
      )`;
    }
  } else if (category === 'movies' || category === 'films') {
    querySql = sql`${querySql} AND n.node_type = 'MOVIE'`;
    if (tag) {
      querySql = sql`${querySql} AND (
        ((v.value_slug = ${tag} OR v.value_text ILIKE ${tag}) AND a.code = 'genre')
        OR n.parent_id IN (
          SELECT c.id FROM media_nodes c 
          JOIN node_eav_links cl ON cl.node_id = c.id 
          JOIN eav_values cv ON cl.value_id = cv.id 
          JOIN eav_attributes ca ON cv.attribute_id = ca.id 
          WHERE ca.code = 'genre' AND (cv.value_slug = ${tag} OR cv.value_text ILIKE ${tag})
        )
      )`;
    }
  } else {
    querySql = sql`${querySql} AND (n.node_type IN ('SHOW', 'COLLECTION', 'MOVIE'))`;

    if (category === 'studios' && tag) {
      querySql = sql`${querySql} AND (
        ((v.value_slug = ${tag} OR v.value_text ILIKE ${tag}) AND a.code = 'studio')
        OR n.id IN (
          SELECT c.parent_id FROM media_nodes c 
          JOIN node_eav_links cl ON cl.node_id = c.id 
          JOIN eav_values cv ON cl.value_id = cv.id 
          JOIN eav_attributes ca ON cv.attribute_id = ca.id 
          WHERE c.parent_id IS NOT NULL AND ca.code = 'studio' AND (cv.value_slug = ${tag} OR cv.value_text ILIKE ${tag})
        )
      )`;
    } else if (category === 'qualities' && tag) {
      const tagLower = tag.toLowerCase();
      let qualPattern = '(?i)\\y' + tagLower + '\\y';
      if (tagLower === '4k' || tagLower === '2160p' || tagLower.includes('4k')) {
        qualPattern = '(?i)\\y(4k|2160p)\\y';
      } else if (tagLower === '1080p' || tagLower === '1080' || tagLower.includes('1080')) {
        qualPattern = '(?i)\\y(1080p|1080)\\y';
      } else if (tagLower === '720p' || tagLower === '720' || tagLower.includes('720')) {
        qualPattern = '(?i)\\y(720p|720)\\y';
      } else if (tagLower === '576p' || tagLower === '576' || tagLower.includes('576')) {
        qualPattern = '(?i)\\y(576p|576)\\y';
      } else if (tagLower === '480p' || tagLower === '480' || tagLower === 'sd' || tagLower.includes('480')) {
        qualPattern = '(?i)\\y(480p|480|sd)\\y';
      } else if (tagLower === '360p' || tagLower === '360' || tagLower.includes('360')) {
        qualPattern = '(?i)\\y(360p|360)\\y';
      }

      querySql = sql`${querySql} AND (
        n.video_file_path ~* ${qualPattern}
        OR n.search_vector_text ~* ${qualPattern}
        OR n.id IN (
          SELECT l.node_id FROM node_eav_links l
          JOIN eav_values v ON l.value_id = v.id
          JOIN eav_attributes a ON v.attribute_id = a.id
          WHERE a.code IN ('video_quality', 'quality', 'resolution') AND v.value_text ~* ${qualPattern}
        )
        OR n.id IN (
          SELECT c.parent_id FROM media_nodes c
          WHERE c.parent_id IS NOT NULL AND (
            c.video_file_path ~* ${qualPattern}
            OR c.id IN (
              SELECT cl.node_id FROM node_eav_links cl
              JOIN eav_values cv ON cl.value_id = cv.id
              JOIN eav_attributes ca ON cv.attribute_id = ca.id
              WHERE ca.code IN ('video_quality', 'quality', 'resolution') AND cv.value_text ~* ${qualPattern}
            )
          )
        )
      )`;
    } else if (category === 'directors' && tag) {
      querySql = sql`${querySql} AND (
        ((v.value_slug = ${tag} OR v.value_text ILIKE ${tag}) AND a.code = 'director')
        OR n.id IN (
          SELECT c.parent_id FROM media_nodes c 
          JOIN node_eav_links cl ON cl.node_id = c.id 
          JOIN eav_values cv ON cl.value_id = cv.id 
          JOIN eav_attributes ca ON cv.attribute_id = ca.id 
          WHERE c.parent_id IS NOT NULL AND ca.code = 'director' AND (cv.value_slug = ${tag} OR cv.value_text ILIKE ${tag})
        )
      )`;
    } else if ((category === 'countries' || category === 'pays') && tag) {
      const isUS = tag === 'etats-unis' || tag === 'us' || tag === 'usa';
      const isFR = tag === 'france' || tag === 'fr';
      const isUK = tag === 'royaume-uni' || tag === 'gb' || tag === 'uk' || tag === 'united-kingdom';
      const isJP = tag === 'japon' || tag === 'japan' || tag === 'jp';
      const isCA = tag === 'canada' || tag === 'ca';
      const isDE = tag === 'allemagne' || tag === 'germany' || tag === 'de';
      const isBE = tag === 'belgique' || tag === 'belgium' || tag === 'be';
      const isIT = tag === 'italie' || tag === 'italy' || tag === 'it';
      const isKR = tag === 'coree-du-sud' || tag === 'south-korea' || tag === 'kr';
      const isES = tag === 'espagne' || tag === 'spain' || tag === 'es';
      const isAU = tag === 'australie' || tag === 'australia' || tag === 'au';
      const isNZ = tag === 'nouvelle-zelande' || tag === 'new-zealand' || tag === 'nz';
      const isCH = tag === 'suisse' || tag === 'switzerland' || tag === 'ch';

      let countryCond = sql`(v.value_slug = ${tag} OR v.value_text ILIKE ${tag})`;
      if (isUS) countryCond = sql`(v.value_text IN ('United States of America', 'US', 'USA') OR v.value_slug IN ('us', 'usa', 'united-states-of-america', 'etats-unis'))`;
      else if (isFR) countryCond = sql`(v.value_text IN ('France', 'FR') OR v.value_slug IN ('fr', 'france'))`;
      else if (isUK) countryCond = sql`(v.value_text IN ('United Kingdom', 'GB', 'UK') OR v.value_slug IN ('gb', 'uk', 'united-kingdom', 'royaume-uni'))`;
      else if (isJP) countryCond = sql`(v.value_text IN ('Japan', 'JP') OR v.value_slug IN ('jp', 'japan', 'japon'))`;
      else if (isCA) countryCond = sql`(v.value_text IN ('Canada', 'CA') OR v.value_slug IN ('ca', 'canada'))`;
      else if (isDE) countryCond = sql`(v.value_text IN ('Germany', 'DE') OR v.value_slug IN ('de', 'germany', 'allemagne'))`;
      else if (isBE) countryCond = sql`(v.value_text IN ('Belgium', 'BE') OR v.value_slug IN ('be', 'belgium', 'belgique'))`;
      else if (isIT) countryCond = sql`(v.value_text IN ('Italy', 'IT') OR v.value_slug IN ('it', 'italy', 'italie'))`;
      else if (isKR) countryCond = sql`(v.value_text IN ('South Korea', 'KR') OR v.value_slug IN ('kr', 'south-korea', 'coree-du-sud'))`;
      else if (isES) countryCond = sql`(v.value_text IN ('Spain', 'ES') OR v.value_slug IN ('es', 'spain', 'espagne'))`;
      else if (isAU) countryCond = sql`(v.value_text IN ('Australia', 'AU') OR v.value_slug IN ('au', 'australia', 'australie'))`;
      else if (isNZ) countryCond = sql`(v.value_text IN ('New Zealand', 'NZ') OR v.value_slug IN ('nz', 'new-zealand', 'nouvelle-zelande'))`;
      else if (isCH) countryCond = sql`(v.value_text IN ('Switzerland', 'CH') OR v.value_slug IN ('ch', 'switzerland', 'suisse'))`;

      querySql = sql`${querySql} AND (
        (${countryCond} AND a.code = 'country')
        OR n.id IN (
          SELECT c.parent_id FROM media_nodes c 
          JOIN node_eav_links cl ON cl.node_id = c.id 
          JOIN eav_values cv ON cl.value_id = cv.id 
          JOIN eav_attributes ca ON cv.attribute_id = ca.id 
          WHERE c.parent_id IS NOT NULL AND ca.code = 'country' AND ${countryCond}
        )
      )`;
    } else if (category === 'themes' && tag) {
      querySql = sql`${querySql} AND (
        ((v.value_slug = ${tag} OR v.value_text ILIKE ${tag}) AND a.code IN ('subject', 'tag'))
        OR n.id IN (
          SELECT c.parent_id FROM media_nodes c 
          JOIN node_eav_links cl ON cl.node_id = c.id 
          JOIN eav_values cv ON cl.value_id = cv.id 
          JOIN eav_attributes ca ON cv.attribute_id = ca.id 
          WHERE c.parent_id IS NOT NULL AND ca.code IN ('subject', 'tag') AND (cv.value_slug = ${tag} OR cv.value_text ILIKE ${tag})
        )
      )`;
    }
  }

  if (excludeIdsParam) {
    const rawIds = excludeIdsParam.split(',').map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    if (rawIds.length > 0) {
      querySql = sql`${querySql} AND n.id NOT IN (${sql.join(rawIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
    }
  }

  if (filter && filter !== 'Tous') {
    const fLower = filter.toLowerCase();
    if (fLower === 'movie' || fLower === 'films' || fLower === 'film') {
      querySql = sql`${querySql} AND n.node_type = 'MOVIE'`;
    } else if (fLower === 'show' || fLower === 'séries' || fLower === 'series' || fLower === 'série') {
      querySql = sql`${querySql} AND n.node_type = 'SHOW'`;
    } else if (['4k', '2160p', '1080p', '720p', '576p', '480p'].includes(fLower)) {
      const qPat = fLower === '4k' ? '(?i)\\y(4k|2160p)\\y'
        : fLower === '1080p' ? '(?i)\\y(1080p|1080)\\y'
        : fLower === '720p' ? '(?i)\\y(720p|720)\\y'
        : fLower === '576p' ? '(?i)\\y(576p|576)\\y'
        : '(?i)\\y(480p|480|sd)\\y';
      querySql = sql`${querySql} AND (
        n.video_file_path ~* ${qPat}
        OR n.search_vector_text ~* ${qPat}
        OR n.id IN (
          SELECT l.node_id FROM node_eav_links l
          JOIN eav_values v ON l.value_id = v.id
          JOIN eav_attributes a ON v.attribute_id = a.id
          WHERE a.code IN ('video_quality', 'quality', 'resolution') AND v.value_text ~* ${qPat}
        )
        OR n.id IN (
          SELECT c.parent_id FROM media_nodes c
          WHERE c.parent_id IS NOT NULL AND (
            c.video_file_path ~* ${qPat}
            OR c.id IN (
              SELECT cl.node_id FROM node_eav_links cl
              JOIN eav_values cv ON cl.value_id = cv.id
              JOIN eav_attributes ca ON cv.attribute_id = ca.id
              WHERE ca.code IN ('video_quality', 'quality', 'resolution') AND cv.value_text ~* ${qPat}
            )
          )
        )
      )`;
    } else {
      const fp = `%${fLower}%`;
      querySql = sql`${querySql} AND (
        n.video_file_path ILIKE ${fp} OR n.search_vector_text ILIKE ${fp} OR n.node_type::text ILIKE ${fp}
        OR (v.value_text ILIKE ${fp} AND a.code IN ('genre', 'subject', 'tag'))
        OR n.id IN (
          SELECT COALESCE(c.parent_id, c.id) FROM media_nodes c
          LEFT JOIN node_eav_links cl ON cl.node_id = c.id
          LEFT JOIN eav_values cv ON cl.value_id = cv.id
          LEFT JOIN eav_attributes ca ON cv.attribute_id = ca.id
          WHERE (c.video_file_path ILIKE ${fp} OR c.search_vector_text ILIKE ${fp} OR (cv.value_text ILIKE ${fp} AND ca.code IN ('genre', 'subject', 'tag')))
        )
      )`;
    }
  }

  if (q) {
    querySql = sql`${querySql} AND (n.title ILIKE ${'%' + q + '%'} OR n.search_vector_text ILIKE ${'%' + q + '%'} OR v.value_text ILIKE ${'%' + q + '%'})`;
  }

  const fetchLimit = limit + 1;
  querySql = sql`${querySql} ORDER BY n.community_rating DESC NULLS LAST, n.release_year DESC NULLS LAST LIMIT ${fetchLimit};`;

  const rows = await db.execute(querySql);
  const rawItems = Array.from(rows);
  const hasMore = rawItems.length > limit;
  const sliced = hasMore ? rawItems.slice(0, limit) : rawItems;

  const itemIds = sliced.map((item: any) => item.id);
  const qualityMap: Record<string, string> = {};

  if (itemIds.length > 0) {
    const qualRows = await db.execute(sql`
      SELECT n.id,
        COALESCE(
          (SELECT CASE 
              WHEN ev.value_text ~* '(?i)\\y(4k|2160p)\\y' THEN '4K'
              WHEN ev.value_text ~* '(?i)\\y(1080p|1080)\\y' THEN '1080p'
              WHEN ev.value_text ~* '(?i)\\y(720p|720)\\y' THEN '720p'
              WHEN ev.value_text ~* '(?i)\\y(576p|576)\\y' THEN '576p'
              WHEN ev.value_text ~* '(?i)\\y(480p|480|sd)\\y' THEN '480p'
              ELSE NULL END
           FROM node_eav_links el
           JOIN eav_values ev ON el.value_id = ev.id
           JOIN eav_attributes ea ON ev.attribute_id = ea.id
           WHERE el.node_id = n.id AND ea.code IN ('video_quality', 'quality', 'resolution')
           LIMIT 1
          ),
          (SELECT CASE
              WHEN (c.video_file_path || ' ' || COALESCE(c.search_vector_text, '')) ~* '(?i)\\y(4k|2160p)\\y' THEN '4K'
              WHEN (c.video_file_path || ' ' || COALESCE(c.search_vector_text, '')) ~* '(?i)\\y(1080p|1080)\\y' THEN '1080p'
              WHEN (c.video_file_path || ' ' || COALESCE(c.search_vector_text, '')) ~* '(?i)\\y(720p|720)\\y' THEN '720p'
              WHEN (c.video_file_path || ' ' || COALESCE(c.search_vector_text, '')) ~* '(?i)\\y(576p|576)\\y' THEN '576p'
              WHEN (c.video_file_path || ' ' || COALESCE(c.search_vector_text, '')) ~* '(?i)\\y(480p|480|sd)\\y' THEN '480p'
              ELSE NULL END
           FROM media_nodes c
           WHERE c.id = n.id OR c.parent_id = n.id
           ORDER BY (c.id = n.id) DESC
           LIMIT 1
          ),
          (SELECT CASE 
              WHEN cev.value_text ~* '(?i)\\y(4k|2160p)\\y' THEN '4K'
              WHEN cev.value_text ~* '(?i)\\y(1080p|1080)\\y' THEN '1080p'
              WHEN cev.value_text ~* '(?i)\\y(720p|720)\\y' THEN '720p'
              WHEN cev.value_text ~* '(?i)\\y(576p|576)\\y' THEN '576p'
              WHEN cev.value_text ~* '(?i)\\y(480p|480|sd)\\y' THEN '480p'
              ELSE NULL END
           FROM media_nodes cn
           JOIN node_eav_links cel ON cel.node_id = cn.id
           JOIN eav_values cev ON cel.value_id = cev.id
           JOIN eav_attributes cea ON cev.attribute_id = cea.id
           WHERE cn.parent_id = n.id AND cea.code IN ('video_quality', 'quality', 'resolution')
           ORDER BY cn.order_index ASC
           LIMIT 1
          )
        ) AS video_quality
      FROM media_nodes n
      WHERE n.id IN (${sql.join(itemIds.map((id: string) => sql`${id}::uuid`), sql`, `)});
    `);

    for (const r of Array.from(qualRows) as any[]) {
      if (r.video_quality) {
        qualityMap[r.id] = r.video_quality;
      }
    }
  }

  const items = sliced.map((item: any) => ({
    id: item.id,
    title: item.title,
    nodeType: item.node_type,
    releaseYear: item.release_year,
    posterPath: `/api/media/${item.id}/poster`,
    communityRating: item.community_rating,
    videoQuality: qualityMap[item.id] || null,
  }));

  return c.json({ items, limit, hasMore, totalReturned: items.length });
});
