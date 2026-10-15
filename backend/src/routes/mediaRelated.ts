import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

export interface RelatedTagGroup {
  label: string;
  slug: string;
  colorTheme?: string;
  isDirector?: boolean;
  medias: any[];
}

export async function getRelatedTagsForMedia(mediaId: string, parentId?: string | null): Promise<RelatedTagGroup[]> {
  const allTagsRes = await db.execute(sql`
    SELECT DISTINCT v.value_text AS label, v.value_slug AS slug, a.color_theme, a.code AS attr_code
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE (
      l.node_id = ${mediaId}
      ${parentId ? sql`OR l.node_id = ${parentId}` : sql``}
      OR l.node_id IN (SELECT id FROM media_nodes WHERE parent_id = ${mediaId} AND is_extra = false)
    )
      AND a.code IN ('director', 'genre', 'subject', 'studio')
    ORDER BY v.value_text ASC;
  `);

  const relatedMediasRes = await db.execute(sql`
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
      ${parentId ? sql`OR l.node_id = ${parentId}` : sql``}
      OR l.node_id IN (SELECT id FROM media_nodes WHERE parent_id = ${mediaId} AND is_extra = false)
    )
      AND a.code IN ('director', 'genre', 'subject', 'studio')
      AND (
        a.code = 'director'
        OR n.node_type IN ('SHOW', 'COLLECTION')
        OR (n.node_type = 'MOVIE' AND (n.parent_id IS NULL OR n.parent_id != ${mediaId}))
      )
      AND n.id != ${mediaId}
      ${parentId ? sql`AND n.id != ${parentId}` : sql``}
      AND (n.parent_id IS NULL OR n.parent_id != ${mediaId})
    ORDER BY n.community_rating DESC NULLS LAST, n.release_year DESC NULLS LAST;
  `);

  const mediasByTag = new Map<string, any[]>();
  for (const row of Array.from(relatedMediasRes) as any[]) {
    if (!mediasByTag.has(row.tag_slug)) mediasByTag.set(row.tag_slug, []);
    mediasByTag.get(row.tag_slug)!.push({
      id: row.id,
      title: row.title,
      nodeType: row.node_type,
      releaseYear: row.release_year,
      posterPath: row.poster_path ? `/api/media/${row.id}/poster` : undefined,
      communityRating: row.community_rating,
    });
  }

  const groups: RelatedTagGroup[] = (Array.from(allTagsRes) as any[]).map((t) => {
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
    if (a.isDirector && !b.isDirector) return -1;
    if (!a.isDirector && b.isDirector) return 1;
    return b.medias.length - a.medias.length;
  });

  const seenMediaIds = new Set<string>();
  if (mediaId) seenMediaIds.add(mediaId);
  if (parentId) seenMediaIds.add(parentId);

  for (const group of activeGroups) {
    const uniqueList: any[] = [];
    for (const m of group.medias) {
      if (!m || !m.id) continue;
      // Pour les réalisateurs, on montre toujours l'oeuvre même si un genre la partage
      if (!group.isDirector && seenMediaIds.has(m.id)) continue;
      seenMediaIds.add(m.id);
      uniqueList.push(m);
    }
    group.medias = uniqueList;
  }

  return activeGroups.filter((g) => g.medias.length > 0);
}
