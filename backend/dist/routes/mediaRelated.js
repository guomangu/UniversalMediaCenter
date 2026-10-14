import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
export async function getRelatedTagsForMedia(mediaId, parentId) {
    const allTagsRes = await db.execute(sql `
    SELECT DISTINCT v.value_text AS label, v.value_slug AS slug, a.color_theme
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE (
      l.node_id = ${mediaId}
      ${parentId ? sql `OR l.node_id = ${parentId}` : sql ``}
      OR l.node_id IN (SELECT id FROM media_nodes WHERE parent_id = ${mediaId} AND is_extra = false)
    )
      AND a.code IN ('genre', 'subject', 'studio')
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
      AND a.code IN ('genre', 'subject', 'studio')
      AND (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
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
    const groups = Array.from(allTagsRes).map((t) => ({
        label: t.label,
        slug: t.slug,
        colorTheme: t.color_theme,
        medias: mediasByTag.get(t.slug) || [],
    }));
    // 1. Trier d'abord les tags par nombre initial de médias décroissant pour prioriser les tags les plus riches
    groups.sort((a, b) => b.medias.length - a.medias.length);
    // 2. Déduplication stricte sans doublons inter-tags (logique identique à l'accueil par catégorie) :
    // Tout média déjà apparu dans un tag précédent sur la page ne doit plus réapparaître dans les tags suivants
    const seenMediaIds = new Set();
    if (mediaId)
        seenMediaIds.add(mediaId);
    if (parentId)
        seenMediaIds.add(parentId);
    for (const group of groups) {
        const uniqueList = [];
        for (const m of group.medias) {
            if (!m || !m.id)
                continue;
            if (seenMediaIds.has(m.id))
                continue;
            seenMediaIds.add(m.id);
            uniqueList.push(m);
        }
        group.medias = uniqueList;
    }
    // 3. Re-trier pour positionner les tags avec médias restants en tête
    return groups.sort((a, b) => {
        if (a.medias.length > 0 && b.medias.length === 0)
            return -1;
        if (a.medias.length === 0 && b.medias.length > 0)
            return 1;
        return b.medias.length - a.medias.length;
    });
}
