import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { buildMediaAccessConditions } from '../auth/mediaAccessSql.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';
export const peopleRouter = new Hono();
const PERSON_ROLE_CODES = ['actor', 'director', 'writer', 'producer', 'composer'];
const ROLE_LABELS = {
    actor: 'Acteur / Actrice',
    director: 'Réalisation',
    writer: 'Scénario',
    producer: 'Production',
    composer: 'Musique',
};
/**
 * Fiche personne (acteur, réalisateur, scénariste, producteur, compositeur).
 *
 * La recherche renvoyait déjà des personnes, mais aucun endpoint ne permettait
 * d'afficher leur filmographie : le clic sur un comédien ouvrait un salon de
 * forum. Cette route fournit la page dédiée promise par le cahier des charges
 * (« Filmographie locale »), avec les mêmes filtres d'accès que le catalogue.
 */
peopleRouter.get('/:slug', async (c) => {
    const slug = c.req.param('slug').trim().toLowerCase();
    const user = c.get('user');
    if (!slug) {
        return c.json({ error: 'Identifiant de personne manquant' }, 400);
    }
    const identityRows = await db.execute(sql `
    SELECT v.value_text AS name, v.value_slug AS slug, v.metadata_json, a.code AS role
    FROM eav_values v
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE v.value_slug = ${slug}
      AND a.code IN ('actor', 'director', 'writer', 'producer', 'composer')
  `);
    const identities = Array.from(identityRows);
    if (identities.length === 0) {
        return c.json({ error: 'Personne introuvable dans le catalogue local' }, 404);
    }
    const name = identities[0].name;
    const roles = Array.from(new Set(identities.map((row) => row.role).filter(Boolean)));
    const thumbnailUrl = identities.find((row) => row.metadata_json?.thumbUrl)?.metadata_json?.thumbUrl || null;
    let querySql = sql `
    SELECT n.id, n.title, n.node_type, n.release_year, n.poster_path, n.community_rating,
           n.video_file_path, n.nfo_file_path, n.search_vector_text,
           COALESCE(
             n.video_file_path,
             n.nfo_file_path,
             (SELECT c.video_file_path FROM media_nodes c WHERE c.parent_id = n.id AND c.video_file_path IS NOT NULL LIMIT 1)
           ) AS effective_physical_path,
           a.code AS role,
           l.context_role,
           l.order_index
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    JOIN media_nodes n ON l.node_id = n.id
    WHERE v.value_slug = ${slug}
      AND a.code IN ('actor', 'director', 'writer', 'producer', 'composer')
      AND n.is_extra = false
  `;
    for (const condition of buildMediaAccessConditions(user, 'n')) {
        querySql = sql `${querySql} AND ${condition}`;
    }
    querySql = sql `${querySql} ORDER BY n.release_year DESC NULLS LAST, n.title ASC LIMIT 500;`;
    const rows = await db.execute(querySql);
    const allowedRows = Array.from(rows).filter((row) => isMediaAllowedForUser(user, {
        videoFilePath: row.video_file_path,
        nfoFilePath: row.nfo_file_path,
        searchVectorText: row.search_vector_text,
        nodeType: row.node_type,
        effectivePhysicalPath: row.effective_physical_path,
    }));
    // Une personne taguée sur chaque épisode d'une série ne doit pas produire
    // des centaines de cartes « Épisode 01, 02, 03… ». On remonte chaque épisode
    // ou saison vers sa série/collection parente pour obtenir une filmographie
    // lisible, tout en conservant les films et les épisodes autonomes.
    const ephemeralIds = allowedRows
        .filter((row) => row.node_type === 'EPISODE' || row.node_type === 'SEASON')
        .map((row) => row.id);
    const ancestorTargets = new Map();
    if (ephemeralIds.length > 0) {
        try {
            const ancestorRows = await db.execute(sql `
        WITH RECURSIVE ancestors AS (
          SELECT n.id AS origin_id, n.id, n.parent_id, n.node_type, n.title,
                 n.release_year, n.poster_path, n.community_rating,
                 n.video_file_path, n.nfo_file_path, n.search_vector_text, 0 AS depth
          FROM media_nodes n
          WHERE n.id IN (${sql.join(ephemeralIds.map((id) => sql `${id}::uuid`), sql `, `)})
          UNION ALL
          SELECT a.origin_id, p.id, p.parent_id, p.node_type, p.title,
                 p.release_year, p.poster_path, p.community_rating,
                 p.video_file_path, p.nfo_file_path, p.search_vector_text, a.depth + 1
          FROM media_nodes p
          JOIN ancestors a ON p.id = a.parent_id
          WHERE a.depth < 6 AND a.node_type NOT IN ('SHOW', 'COLLECTION')
        )
        SELECT * FROM ancestors
        WHERE node_type IN ('SHOW', 'COLLECTION')
        ORDER BY origin_id, depth ASC;
      `);
            for (const ancestor of Array.from(ancestorRows)) {
                if (!ancestorTargets.has(ancestor.origin_id)) {
                    ancestorTargets.set(ancestor.origin_id, ancestor);
                }
            }
        }
        catch {
            // En cas d'échec de la remontée, on conserve les épisodes individuels
            // plutôt que de perdre la filmographie.
        }
    }
    // Un même film peut réunir plusieurs rôles pour la même personne
    // (acteur + réalisateur). On agrège les rôles au lieu de dupliquer la carte.
    const mediaMap = new Map();
    for (const row of allowedRows) {
        const ancestor = ancestorTargets.get(row.id);
        const target = ancestor || row;
        // Le nœud parent agrégé doit lui aussi respecter les restrictions ABAC
        // (tags bloqués). On réutilise le chemin physique de l'épisode source pour
        // que les règles PBAC restent appliquées.
        if (ancestor &&
            !isMediaAllowedForUser(user, {
                searchVectorText: target.search_vector_text,
                nodeType: target.node_type,
                effectivePhysicalPath: row.effective_physical_path,
            })) {
            continue;
        }
        const existing = mediaMap.get(target.id);
        if (existing) {
            if (!existing.roles.includes(row.role))
                existing.roles.push(row.role);
            if (row.context_role && !existing.characters.includes(row.context_role)) {
                existing.characters.push(row.context_role);
            }
            continue;
        }
        mediaMap.set(target.id, {
            id: target.id,
            title: target.title,
            nodeType: target.node_type,
            releaseYear: target.release_year,
            posterPath: `/api/media/${target.id}/poster`,
            communityRating: target.community_rating,
            roles: [row.role],
            characters: row.context_role ? [row.context_role] : [],
        });
    }
    const medias = Array.from(mediaMap.values()).sort((a, b) => {
        const yearDiff = (Number(b.releaseYear) || 0) - (Number(a.releaseYear) || 0);
        return yearDiff !== 0 ? yearDiff : String(a.title).localeCompare(String(b.title));
    });
    const roleCounts = {};
    for (const media of medias) {
        for (const role of media.roles) {
            roleCounts[role] = (roleCounts[role] || 0) + 1;
        }
    }
    return c.json({
        person: {
            name,
            slug,
            thumbnailUrl,
            roles,
            roleLabels: roles.map((role) => ROLE_LABELS[role] || role),
            totalMedias: medias.length,
        },
        roleCounts,
        medias,
    });
});
