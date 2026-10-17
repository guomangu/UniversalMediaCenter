import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { buildMediaAccessConditions } from '../auth/mediaAccessSql.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';
/**
 * Récupère les films et séries associés pour une liste de tags donnée (slugs)
 * Retourne une liste de groupes d'association avec un maximum de 10 films par groupe.
 * Applique la double barrière de sécurité SQL & JS (Zero-Leak).
 */
export async function fetchMediaGroupsByTags(tags, limitPerGroup = 10, user) {
    if (!tags || tags.length === 0)
        return [];
    const slugs = tags.map((t) => t.slug).filter(Boolean);
    if (slugs.length === 0)
        return [];
    const inSlugs = sql.join(slugs.map((s) => sql `${s}`), sql `, `);
    const accessConds = buildMediaAccessConditions(user, 'n');
    let accessCondsSql = sql ``;
    for (const cond of accessConds) {
        accessCondsSql = sql `${accessCondsSql} AND ${cond}`;
    }
    // Requête optimisée utilisant l'index sur value_slug et groupant les médias
    const results = await db.execute(sql `
    SELECT DISTINCT
      v.value_slug AS tag_slug,
      v.value_text AS tag_name,
      a.code AS attr_code,
      n.id,
      n.title,
      n.node_type,
      n.release_year,
      n.poster_path,
      n.community_rating,
      n.video_file_path,
      n.nfo_file_path,
      n.search_vector_text,
      COALESCE(
        n.video_file_path,
        n.nfo_file_path,
        (SELECT c.video_file_path FROM media_nodes c WHERE (c.parent_id = n.id OR c.parent_id IN (SELECT id FROM media_nodes WHERE parent_id = n.id)) AND c.video_file_path IS NOT NULL LIMIT 1)
      ) AS effective_physical_path
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    JOIN node_eav_links l ON l.value_id = v.id
    JOIN media_nodes child ON l.node_id = child.id
    JOIN media_nodes n ON (
      CASE 
        WHEN child.parent_id IS NOT NULL THEN child.parent_id 
        ELSE child.id 
      END = n.id
    )
    WHERE v.value_slug IN (${inSlugs})
      AND n.is_extra = false
      AND (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
      ${accessCondsSql}
    ORDER BY n.community_rating DESC NULLS LAST, n.release_year DESC NULLS LAST;
  `);
    const mediaByTag = new Map();
    for (const row of Array.from(results)) {
        if (!isMediaAllowedForUser(user, {
            title: row.title,
            nodeType: row.node_type,
            videoFilePath: row.video_file_path,
            nfoFilePath: row.nfo_file_path,
            effectivePhysicalPath: row.effective_physical_path,
            searchVectorText: row.search_vector_text,
        })) {
            continue;
        }
        if (!mediaByTag.has(row.tag_slug))
            mediaByTag.set(row.tag_slug, []);
        const list = mediaByTag.get(row.tag_slug);
        if (list.length < limitPerGroup) {
            // Déduplication par id dans le groupe
            if (!list.some((m) => m.id === row.id)) {
                list.push({
                    id: row.id,
                    title: row.title,
                    nodeType: row.node_type,
                    releaseYear: row.release_year,
                    posterPath: row.poster_path ? `/api/media/${row.id}/poster` : undefined,
                    communityRating: row.community_rating ? Number(row.community_rating) : null,
                });
            }
        }
    }
    const groups = [];
    for (const t of tags) {
        const medias = mediaByTag.get(t.slug) || [];
        if (medias.length > 0) {
            groups.push({
                name: t.name,
                slug: t.slug,
                code: t.code,
                count: medias.length,
                medias,
            });
        }
    }
    return groups;
}
/**
 * Fournit les données d'exploration globale de /forum avec les 4 modules d'association :
 * 1. Œuvres associées (Sagas phares)
 * 2. Acteurs & personnalités associées
 * 3. Structures & studios de production
 * 4. Genres & origines géographiques
 */
export async function fetchForumExploreData(user) {
    try {
        const accessConds = buildMediaAccessConditions(user, 'n');
        let accessCondsSql = sql ``;
        for (const cond of accessConds) {
            accessCondsSql = sql `${accessCondsSql} AND ${cond}`;
        }
        // A. Salons récemment actifs
        const activeRes = await db.execute(sql `
      SELECT 
        topic_slug AS "topicSlug", 
        topic_title AS "topicTitle", 
        COUNT(*)::int AS "msgCount", 
        MAX(created_at) AS "lastMsgAt"
      FROM forum_messages
      GROUP BY topic_slug, topic_title
      ORDER BY MAX(created_at) DESC
      LIMIT 12;
    `);
        // B. Top acteurs
        const actorsRes = await db.execute(sql `
      SELECT v.value_text AS title, v.value_slug AS slug, COUNT(DISTINCT l.node_id)::int AS count
      FROM eav_values v
      JOIN eav_attributes a ON v.attribute_id = a.id
      JOIN node_eav_links l ON l.value_id = v.id
      JOIN media_nodes n ON l.node_id = n.id
      WHERE a.code = 'actor'
        AND n.is_extra = false
        ${accessCondsSql}
      GROUP BY v.value_text, v.value_slug
      HAVING COUNT(DISTINCT l.node_id) > 0
      ORDER BY count DESC
      LIMIT 15;
    `);
        // C. Top équipe technique (réalisateurs / auteurs)
        const crewRes = await db.execute(sql `
      SELECT v.value_text AS title, v.value_slug AS slug, a.code AS role, COUNT(DISTINCT l.node_id)::int AS count
      FROM eav_values v
      JOIN eav_attributes a ON v.attribute_id = a.id
      JOIN node_eav_links l ON l.value_id = v.id
      JOIN media_nodes n ON l.node_id = n.id
      WHERE a.code IN ('director', 'writer')
        AND n.is_extra = false
        ${accessCondsSql}
      GROUP BY v.value_text, v.value_slug, a.code
      HAVING COUNT(DISTINCT l.node_id) > 0
      ORDER BY count DESC
      LIMIT 15;
    `);
        // D. Top studios
        const studiosRes = await db.execute(sql `
      SELECT v.value_text AS title, v.value_slug AS slug, COUNT(DISTINCT l.node_id)::int AS count
      FROM eav_values v
      JOIN eav_attributes a ON v.attribute_id = a.id
      JOIN node_eav_links l ON l.value_id = v.id
      JOIN media_nodes n ON l.node_id = n.id
      WHERE a.code = 'studio'
        AND n.is_extra = false
        ${accessCondsSql}
      GROUP BY v.value_text, v.value_slug
      HAVING COUNT(DISTINCT l.node_id) > 0
      ORDER BY count DESC
      LIMIT 15;
    `);
        // E. Top genres & pays
        const genresRes = await db.execute(sql `
      SELECT v.value_text AS title, v.value_slug AS slug, a.code AS code, COUNT(DISTINCT l.node_id)::int AS count
      FROM eav_values v
      JOIN eav_attributes a ON v.attribute_id = a.id
      JOIN node_eav_links l ON l.value_id = v.id
      JOIN media_nodes n ON l.node_id = n.id
      WHERE a.code IN ('genre', 'country')
        AND n.is_extra = false
        ${accessCondsSql}
      GROUP BY v.value_text, v.value_slug, a.code
      HAVING COUNT(DISTINCT l.node_id) > 0
      ORDER BY count DESC
      LIMIT 15;
    `);
        const topActors = Array.from(actorsRes).map((r) => ({
            title: r.title,
            slug: r.slug,
            count: Number(r.count),
        }));
        const topCrew = Array.from(crewRes).map((r) => ({
            title: r.title,
            slug: r.slug,
            role: r.role,
            count: Number(r.count),
        }));
        const topStudios = Array.from(studiosRes).map((r) => ({
            title: r.title,
            slug: r.slug,
            count: Number(r.count),
        }));
        const topGenres = Array.from(genresRes).map((r) => ({
            title: r.title,
            slug: r.slug,
            code: r.code,
            count: Number(r.count),
        }));
        // F. 1. Œuvres associées (Sagas / Collections majeures avec leurs films respectifs)
        const sagaAccessConds = buildMediaAccessConditions(user, 'm');
        let sagaAccessSql = sql ``;
        for (const cond of sagaAccessConds) {
            sagaAccessSql = sql `${sagaAccessSql} AND ${cond}`;
        }
        const sagasRes = await db.execute(sql `
      SELECT 
        c.id AS saga_id,
        c.title AS saga_title,
        c.slug AS saga_slug,
        c.video_file_path AS saga_video_file_path,
        c.nfo_file_path AS saga_nfo_file_path,
        c.search_vector_text AS saga_search_vector_text,
        m.id,
        m.title,
        m.node_type,
        m.release_year,
        m.poster_path,
        m.community_rating,
        m.video_file_path,
        m.nfo_file_path,
        m.search_vector_text
      FROM media_nodes c
      JOIN media_nodes m ON m.parent_id = c.id
      WHERE c.node_type = 'COLLECTION' AND m.is_extra = false
        ${sagaAccessSql}
      ORDER BY c.community_rating DESC NULLS LAST, m.release_year ASC
      LIMIT 60;
    `);
        const sagasMap = new Map();
        for (const row of Array.from(sagasRes)) {
            if (!isMediaAllowedForUser(user, {
                title: row.title,
                nodeType: row.node_type,
                videoFilePath: row.video_file_path,
                nfoFilePath: row.nfo_file_path,
                searchVectorText: row.search_vector_text,
            })) {
                continue;
            }
            if (!sagasMap.has(row.saga_id)) {
                sagasMap.set(row.saga_id, {
                    name: `Saga ${row.saga_title}`,
                    slug: row.saga_slug || row.saga_id,
                    medias: [],
                });
            }
            const saga = sagasMap.get(row.saga_id);
            if (saga.medias.length < 10) {
                saga.medias.push({
                    id: row.id,
                    title: row.title,
                    nodeType: row.node_type,
                    releaseYear: row.release_year,
                    posterPath: row.poster_path ? `/api/media/${row.id}/poster` : undefined,
                    communityRating: row.community_rating ? Number(row.community_rating) : null,
                });
            }
        }
        const oeuvreGroups = Array.from(sagasMap.values())
            .filter((s) => s.medias.length > 0)
            .slice(0, 4);
        // G. 2. Acteurs & personnalités associées (Top 4 acteurs)
        const actorGroups = await fetchMediaGroupsByTags(topActors.slice(0, 4).map((a) => ({ name: `Films avec ${a.title}`, slug: a.slug, code: 'actor' })), 10, user);
        // H. 3. Structures & studios de production (Top 4 studios)
        const studioGroups = await fetchMediaGroupsByTags(topStudios.slice(0, 4).map((s) => ({ name: `Productions ${s.title}`, slug: s.slug, code: 'studio' })), 10, user);
        // I. 4. Genres & origines géographiques (Top 4 genres/pays)
        const genreGroups = await fetchMediaGroupsByTags(topGenres.slice(0, 4).map((g) => ({
            name: g.code === 'country' ? `Origine : ${g.title}` : `Univers : ${g.title}`,
            slug: g.slug,
            code: g.code,
        })), 10, user);
        return {
            success: true,
            activeDiscussions: Array.from(activeRes),
            topActors,
            topCrew,
            topStudios,
            topGenres,
            oeuvreGroups,
            actorGroups,
            studioGroups,
            genreGroups,
        };
    }
    catch (err) {
        console.error('Error in fetchForumExploreData:', err);
        return {
            success: false,
            error: err?.message || 'Erreur interne exploration forum',
        };
    }
}
/**
 * Récupère le contexte complet d'un sujet (topic) précis :
 * Bannière spotlight, liste des médias directs, tags associés,
 * et les 4 modules d'association complets avec application des droits utilisateurs.
 */
export async function fetchTopicContextData(topicSlug, title, category, user) {
    try {
        const cleanSlug = topicSlug.toLowerCase().trim();
        const cleanTitle = (title || cleanSlug).trim();
        // 1. Détecter l'entité du sujet (Tag EAV ou Média Node) par SQL direct
        const tagEntityRes = await db.execute(sql `
      SELECT v.id, v.value_text, v.value_slug, a.code AS attr_code, a.display_name AS attr_name
      FROM eav_values v
      JOIN eav_attributes a ON v.attribute_id = a.id
      WHERE v.value_slug = ${cleanSlug} OR v.value_text ILIKE ${cleanTitle}
      LIMIT 1;
    `);
        const tagEntity = Array.from(tagEntityRes)[0] || null;
        let mediaEntity = null;
        if (!tagEntity) {
            const mediaEntityRes = await db.execute(sql `
        SELECT id, title, slug, node_type, poster_path, fanart_path, community_rating, release_year,
               video_file_path, nfo_file_path, search_vector_text,
               COALESCE(
                 video_file_path,
                 nfo_file_path,
                 (SELECT c.video_file_path FROM media_nodes c WHERE (c.parent_id = media_nodes.id OR c.parent_id IN (SELECT id FROM media_nodes WHERE parent_id = media_nodes.id)) AND c.video_file_path IS NOT NULL LIMIT 1)
               ) AS effective_physical_path
        FROM media_nodes
        WHERE slug = ${cleanSlug} OR id::text = ${cleanSlug} OR title ILIKE ${cleanTitle}
        LIMIT 1;
      `);
            const foundMedia = Array.from(mediaEntityRes)[0] || null;
            if (foundMedia &&
                isMediaAllowedForUser(user, {
                    title: foundMedia.title,
                    nodeType: foundMedia.node_type,
                    videoFilePath: foundMedia.video_file_path,
                    nfoFilePath: foundMedia.nfo_file_path,
                    effectivePhysicalPath: foundMedia.effective_physical_path,
                    searchVectorText: foundMedia.search_vector_text,
                })) {
                mediaEntity = foundMedia;
            }
        }
        // 2. Déterminer le typeLabel et les métadonnées
        let typeLabel = 'Salon Thématique';
        let backdropUrl = null;
        let posterUrl = null;
        let topicTitle = cleanTitle || cleanSlug;
        if (tagEntity) {
            topicTitle = tagEntity.value_text;
            const attrCode = tagEntity.attr_code;
            if (attrCode === 'actor')
                typeLabel = 'Acteur / Comédien';
            else if (attrCode === 'director')
                typeLabel = 'Réalisateur';
            else if (attrCode === 'studio')
                typeLabel = 'Studio de Production';
            else if (attrCode === 'genre')
                typeLabel = 'Genre Cinématographique';
            else if (attrCode === 'country')
                typeLabel = "Pays d'Origine";
            else if (attrCode === 'franchise' || attrCode === 'universe')
                typeLabel = 'Franchise & Univers';
        }
        else if (mediaEntity) {
            topicTitle = mediaEntity.title;
            typeLabel =
                mediaEntity.node_type === 'SHOW'
                    ? 'Série Télévisée'
                    : mediaEntity.node_type === 'COLLECTION'
                        ? 'Saga / Franchise'
                        : 'Film Patrimoine';
            backdropUrl = mediaEntity.fanart_path ? `/api/media/${mediaEntity.id}/fanart` : null;
            posterUrl = mediaEntity.poster_path ? `/api/media/${mediaEntity.id}/poster` : null;
        }
        // 3. Récupérer les médias directement liés à ce sujet
        let mediaResults = [];
        const accessConds = buildMediaAccessConditions(user, 'n');
        let accessCondsSql = sql ``;
        for (const cond of accessConds) {
            accessCondsSql = sql `${accessCondsSql} AND ${cond}`;
        }
        if (tagEntity) {
            const rawMedias = await db.execute(sql `
        SELECT DISTINCT
          n.id, n.title, n.node_type, n.release_year, n.poster_path, n.fanart_path, n.community_rating,
          n.video_file_path, n.nfo_file_path, n.search_vector_text,
          COALESCE(
            n.video_file_path,
            n.nfo_file_path,
            (SELECT c.video_file_path FROM media_nodes c WHERE (c.parent_id = n.id OR c.parent_id IN (SELECT id FROM media_nodes WHERE parent_id = n.id)) AND c.video_file_path IS NOT NULL LIMIT 1)
          ) AS effective_physical_path
        FROM node_eav_links l
        JOIN media_nodes child ON l.node_id = child.id
        JOIN media_nodes n ON (
          CASE 
            WHEN child.parent_id IS NOT NULL THEN child.parent_id 
            ELSE child.id 
          END = n.id
        )
        WHERE l.value_id = ${tagEntity.id}
          AND n.is_extra = false
          AND (n.node_type IN ('SHOW', 'COLLECTION') OR (n.node_type = 'MOVIE' AND n.parent_id IS NULL))
          ${accessCondsSql}
        ORDER BY n.community_rating DESC NULLS LAST, n.release_year DESC NULLS LAST
        LIMIT 30;
      `);
            mediaResults = Array.from(rawMedias).filter((row) => isMediaAllowedForUser(user, {
                title: row.title,
                nodeType: row.node_type,
                videoFilePath: row.video_file_path,
                nfoFilePath: row.nfo_file_path,
                effectivePhysicalPath: row.effective_physical_path,
                searchVectorText: row.search_vector_text,
            }));
        }
        else if (mediaEntity) {
            if (mediaEntity.node_type === 'COLLECTION') {
                const childMedias = await db.execute(sql `
          SELECT n.id, n.title, n.node_type, n.release_year, n.poster_path, n.fanart_path, n.community_rating,
                 n.video_file_path, n.nfo_file_path, n.search_vector_text
          FROM media_nodes n
          WHERE n.parent_id = ${mediaEntity.id} AND n.is_extra = false
            ${accessCondsSql}
          ORDER BY n.order_index ASC, n.release_year ASC;
        `);
                mediaResults = Array.from(childMedias).filter((row) => isMediaAllowedForUser(user, {
                    title: row.title,
                    nodeType: row.node_type,
                    videoFilePath: row.video_file_path,
                    nfoFilePath: row.nfo_file_path,
                    searchVectorText: row.search_vector_text,
                }));
            }
            else {
                mediaResults = [mediaEntity];
            }
        }
        const directMedias = mediaResults.map((m) => ({
            id: m.id,
            title: m.title,
            nodeType: m.node_type || m.nodeType,
            releaseYear: m.release_year || m.releaseYear,
            posterPath: m.poster_path ? `/api/media/${m.id}/poster` : undefined,
            communityRating: m.community_rating ? Number(m.community_rating) : null,
        }));
        if (!backdropUrl && mediaResults.length > 0 && mediaResults[0].fanart_path) {
            backdropUrl = `/api/media/${mediaResults[0].id}/fanart`;
        }
        if (!posterUrl && mediaResults.length > 0 && mediaResults[0].poster_path) {
            posterUrl = `/api/media/${mediaResults[0].id}/poster`;
        }
        // 4. Récupérer les tags associés à cet ensemble de médias (acteurs, équipe, studios, genres, pays)
        const mediaIds = directMedias.map((m) => m.id);
        const tagsData = {
            actors: [],
            crew: [],
            studios: [],
            genres: [],
            countries: [],
        };
        if (mediaIds.length > 0) {
            const inMediaIds = sql.join(mediaIds.map((id) => sql `${id}`), sql `, `);
            const rawTags = await db.execute(sql `
        SELECT 
          a.code,
          v.value_text,
          v.value_slug,
          COUNT(DISTINCT n.id)::int AS count
        FROM node_eav_links l
        JOIN eav_values v ON l.value_id = v.id
        JOIN eav_attributes a ON v.attribute_id = a.id
        JOIN media_nodes child ON l.node_id = child.id
        JOIN media_nodes n ON (
          CASE 
            WHEN child.parent_id IS NOT NULL THEN child.parent_id 
            ELSE child.id 
          END = n.id
        )
        WHERE n.id IN (${inMediaIds})
          AND a.code IN ('actor', 'director', 'writer', 'studio', 'genre', 'country')
        GROUP BY a.code, v.value_text, v.value_slug
        ORDER BY count DESC
        LIMIT 60;
      `);
            for (const row of Array.from(rawTags)) {
                const item = {
                    code: row.code,
                    value_text: row.value_text,
                    value_slug: row.value_slug,
                    count: Number(row.count),
                };
                if (row.code === 'actor')
                    tagsData.actors.push(item);
                else if (row.code === 'director' || row.code === 'writer')
                    tagsData.crew.push(item);
                else if (row.code === 'studio')
                    tagsData.studios.push(item);
                else if (row.code === 'genre')
                    tagsData.genres.push(item);
                else if (row.code === 'country')
                    tagsData.countries.push(item);
            }
        }
        // 5. Construire les 4 modules d'association personnalisés pour ce topic :
        let oeuvreGroups = [];
        if (directMedias.length > 1) {
            oeuvreGroups = [
                {
                    name: `Cycle complet ${topicTitle}`,
                    slug: cleanSlug,
                    count: directMedias.length,
                    medias: directMedias,
                },
            ];
        }
        // 2. Acteurs & personnalités associées
        const actorGroups = await fetchMediaGroupsByTags(tagsData.actors.slice(0, 3).map((a) => ({
            name: `Films avec ${a.value_text}`,
            slug: a.value_slug,
            code: 'actor',
        })), 10, user);
        // 3. Structures & studios de production
        const studioGroups = await fetchMediaGroupsByTags(tagsData.studios.slice(0, 3).map((s) => ({
            name: `Productions ${s.value_text}`,
            slug: s.value_slug,
            code: 'studio',
        })), 10, user);
        // 4. Genres & origines géographiques
        const genreTagsToQuery = [
            ...tagsData.genres.slice(0, 2).map((g) => ({
                name: `Univers : ${g.value_text}`,
                slug: g.value_slug,
                code: 'genre',
            })),
            ...tagsData.countries.slice(0, 1).map((c) => ({
                name: `Origine : ${c.value_text}`,
                slug: c.value_slug,
                code: 'country',
            })),
        ];
        const genreGroups = await fetchMediaGroupsByTags(genreTagsToQuery, 10, user);
        return {
            success: true,
            topic: {
                slug: cleanSlug,
                title: topicTitle,
                typeLabel,
                category,
                backdropUrl,
                posterUrl,
                totalMedias: directMedias.length,
                averageRating: directMedias.length > 0 && directMedias[0].communityRating
                    ? Number(directMedias[0].communityRating).toFixed(1)
                    : null,
            },
            medias: directMedias,
            oeuvreGroups,
            actorGroups,
            studioGroups,
            genreGroups,
            tags: tagsData,
        };
    }
    catch (err) {
        console.error('Error in fetchTopicContextData:', err);
        return {
            success: false,
            error: err?.message || 'Erreur interne contexte topic',
        };
    }
}
