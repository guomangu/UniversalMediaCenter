import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
export async function getRelatedTagsForMedia(mediaId, parentId) {
    const allTagsRes = await db.execute(sql `
    SELECT DISTINCT v.value_text AS label, v.value_slug AS slug, a.color_theme, a.code AS attr_code
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE (
      l.node_id = ${mediaId}
      ${parentId ? sql `OR l.node_id = ${parentId}` : sql ``}
      OR l.node_id IN (SELECT id FROM media_nodes WHERE parent_id = ${mediaId} AND is_extra = false)
    )
      AND a.code IN ('director', 'genre', 'subject', 'studio')
    ORDER BY v.value_text ASC;
  `);
    const relatedMediasRes = await db.execute(sql `
    SELECT DISTINCT 
      v.value_slug AS tag_slug,
      n.id, n.title, n.node_type, n.release_year, n.poster_path, n.community_rating
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    JOIN node_eav_links l2 ON l2.value_id = v.id
    JOIN media_nodes n ON l2.node_id = n.id
    WHERE (
      l.node_id = ${mediaId}
      ${parentId ? sql `OR l.node_id = ${parentId}` : sql ``}
      OR l.node_id IN (SELECT id FROM media_nodes WHERE parent_id = ${mediaId} AND is_extra = false)
    )
      AND a.code IN ('director', 'genre', 'subject', 'studio')
      AND (
        a.code = 'director'
        OR n.node_type IN ('SHOW', 'COLLECTION')
        OR (n.node_type = 'MOVIE' AND (n.parent_id IS NULL OR n.parent_id != ${mediaId}))
      )
      AND n.id != ${mediaId}
      ${parentId ? sql `AND n.id != ${parentId}` : sql ``}
      AND (n.parent_id IS NULL OR n.parent_id != ${mediaId})
    ORDER BY n.community_rating DESC NULLS LAST, n.release_year DESC NULLS LAST;
  `);
    const mediasByTag = new Map();
    for (const row of Array.from(relatedMediasRes)) {
        if (!mediasByTag.has(row.tag_slug))
            mediasByTag.set(row.tag_slug, []);
        mediasByTag.get(row.tag_slug).push({
            id: row.id,
            title: row.title,
            nodeType: row.node_type,
            releaseYear: row.release_year,
            posterPath: row.poster_path ? `/api/media/${row.id}/poster` : undefined,
            communityRating: row.community_rating,
        });
    }
    const groups = Array.from(allTagsRes).map((t) => {
        const isDirector = t.attr_code === 'director';
        const displayLabel = isDirector ? `Films de ${t.label}` : t.label;
        return {
            label: displayLabel,
            slug: t.slug,
            colorTheme: isDirector ? 'amber' : t.color_theme,
            isDirector,
            medias: mediasByTag.get(t.slug) || [],
        };
    });
    // Filtrer uniquement les groupes contenant au moins un film/série connexe
    const activeGroups = groups.filter((g) => g.medias.length > 0);
    // 1. Déduplication stricte sans doublons inter-tags :
    // Le réalisateur est prioritaire et conserve l'intégralité de sa filmographie
    activeGroups.sort((a, b) => {
        if (a.isDirector && !b.isDirector)
            return -1;
        if (!a.isDirector && b.isDirector)
            return 1;
        return b.medias.length - a.medias.length;
    });
    const seenMediaIds = new Set();
    if (mediaId)
        seenMediaIds.add(mediaId);
    if (parentId)
        seenMediaIds.add(parentId);
    for (const group of activeGroups) {
        const uniqueList = [];
        for (const m of group.medias) {
            if (!m || !m.id)
                continue;
            // Pour les réalisateurs, on montre toujours l'oeuvre même si un genre la partage
            if (!group.isDirector && seenMediaIds.has(m.id))
                continue;
            seenMediaIds.add(m.id);
            uniqueList.push(m);
        }
        group.medias = uniqueList;
    }
    return activeGroups.filter((g) => g.medias.length > 0);
}
/**
 * Moteur de Recommandation Algorithmique par TF-IDF / BM25 SQL
 * Pondère chaque tag partagé par sa rareté documentaire globale (IDF)
 * et par un coefficient de catégorie (Réalisateur > Franchise > Auteur > Acteur > Genre).
 */
export async function getTfIdfSimilarMedias(mediaId, limit = 12) {
    try {
        const res = await db.execute(sql `
      WITH target_tags AS (
        SELECT l.value_id, a.code as attr_code
        FROM node_eav_links l
        JOIN eav_values v ON v.id = l.value_id
        JOIN eav_attributes a ON a.id = v.attribute_id
        WHERE l.node_id = ${mediaId}::uuid
      ),
      doc_freqs AS (
        SELECT value_id, count(DISTINCT node_id)::float AS df
        FROM node_eav_links
        GROUP BY value_id
      ),
      scored_nodes AS (
        SELECT 
          l.node_id,
          ROUND(SUM(
            ln(1.0 + ((SELECT count(*)::float FROM media_nodes WHERE node_type IN ('MOVIE', 'SHOW')) / nullif(df.df, 0)))
            * (CASE 
                WHEN tt.attr_code = 'director' THEN 3.0
                WHEN tt.attr_code = 'franchise' THEN 3.5
                WHEN tt.attr_code = 'writer' THEN 2.0
                WHEN tt.attr_code = 'actor' THEN 1.8
                WHEN tt.attr_code = 'genre' THEN 1.0
                ELSE 1.2
              END)
          )::numeric, 2) AS relevance_score,
          count(l.value_id) AS shared_tags_count
        FROM node_eav_links l
        JOIN target_tags tt ON tt.value_id = l.value_id
        JOIN doc_freqs df ON df.value_id = l.value_id
        WHERE l.node_id != ${mediaId}::uuid
        GROUP BY l.node_id
      )
      SELECT m.id, m.title, m.node_type, m.release_year, m.poster_path, m.community_rating,
             s.relevance_score, s.shared_tags_count
      FROM scored_nodes s
      JOIN media_nodes m ON m.id = s.node_id
      WHERE m.node_type IN ('MOVIE', 'SHOW', 'COLLECTION')
        AND m.is_extra = false
      ORDER BY s.relevance_score DESC, m.community_rating DESC NULLS LAST
      LIMIT ${limit};
    `);
        const rows = Array.isArray(res) ? res : res.rows || [];
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            nodeType: r.node_type,
            releaseYear: r.release_year,
            posterPath: r.poster_path ? `/api/media/${r.id}/poster` : undefined,
            communityRating: r.community_rating,
            relevanceScore: parseFloat(r.relevance_score) || 0,
            sharedTagsCount: parseInt(r.shared_tags_count, 10) || 0,
        }));
    }
    catch (err) {
        console.error('Error in getTfIdfSimilarMedias:', err);
        return [];
    }
}
