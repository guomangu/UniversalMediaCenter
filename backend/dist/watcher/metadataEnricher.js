import { db } from '../db/connection.js';
import { mediaNodes, nodeEavLinks } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { fetchExternalMetadata, cleanShowTitle } from './externalMetadata.js';
import { linkTagToNode } from './tagExtractor.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';
import { findOrCreateCollectionNode } from './hierarchyResolver.js';
import { sanitizeReleaseTags, extractYearFromText } from './titleCleaner.js';
/**
 * Calcule l'indice de besoin en métadonnées d'un média.
 * Donne une priorité absolue aux Sagas (COLLECTION), Séries (SHOW) en carence,
 * ainsi qu'aux Films et Séries manquant de Réalisateur ou de Casting.
 */
export function computeMetadataNeedScore(node, tagCount = 0, crewStats = { directors: 0, actors: 0 }) {
    let score = 0;
    // 1. Priorité structurelle de navigation
    if (node.nodeType === 'COLLECTION') {
        score += 250;
    }
    else if (node.nodeType === 'SHOW') {
        score += 150;
    }
    else if (node.nodeType === 'MOVIE') {
        score += 50;
    }
    else if (node.nodeType === 'SEASON') {
        score += 15;
    }
    else {
        // EPISODE : priorité minimale
        score += 0;
    }
    // 2. Carence en métadonnées textuelles et visuelles de base
    if (!node.overview || node.overview.trim().length === 0)
        score += 40;
    if (!node.posterPath)
        score += 30;
    if (!node.fanartPath)
        score += 20;
    if (!node.releaseYear)
        score += 15;
    if (node.communityRating == null)
        score += 15;
    if (!node.tagline)
        score += 10;
    // 3. Carence en tags EAV globaux
    if (tagCount === 0) {
        score += 100;
    }
    else if (tagCount < 5) {
        score += 60;
    }
    else if (tagCount < 15) {
        score += 35;
    }
    else if (tagCount < 30) {
        score += 15;
    }
    // 4. Carence critique en réalisateur et casting (Piliers du cinéma d'auteur / Tarantino, etc.)
    if (node.nodeType === 'MOVIE' || node.nodeType === 'SHOW') {
        if (crewStats.directors === 0)
            score += 120;
        if (crewStats.actors < 3)
            score += 60;
    }
    return score;
}
export async function enrichLibraryMetadata(batchLimit = 80) {
    // 1. Recenser le nombre de tags globaux par média
    const tagCountsRaw = await db
        .select({
        nodeId: nodeEavLinks.nodeId,
        count: sql `count(*)::int`,
    })
        .from(nodeEavLinks)
        .groupBy(nodeEavLinks.nodeId);
    const tagCountMap = new Map();
    for (const row of tagCountsRaw) {
        if (row.nodeId)
            tagCountMap.set(row.nodeId, row.count);
    }
    // 2. Recenser le nombre de réalisateurs et d'acteurs par média
    const crewCountsRaw = await db.execute(sql `
    SELECT l.node_id,
           COUNT(CASE WHEN a.code = 'director' THEN 1 END)::int AS director_count,
           COUNT(CASE WHEN a.code = 'actor' THEN 1 END)::int AS actor_count
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code IN ('director', 'actor')
    GROUP BY l.node_id;
  `);
    const crewCountMap = new Map();
    for (const row of Array.from(crewCountsRaw)) {
        if (row.node_id) {
            crewCountMap.set(row.node_id, {
                directors: row.director_count || 0,
                actors: row.actor_count || 0,
            });
        }
    }
    // 3. Mapper les identifiants TMDb déjà présents dans les tags personnalisés EAV
    const tmdbLinksRaw = await db.execute(sql `
    SELECT l.node_id, v.value_text
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code IN ('custom_tmdbid', 'custom_id') AND v.value_text ~ '^[0-9]+$'
  `);
    const tmdbIdMap = new Map();
    for (const row of Array.from(tmdbLinksRaw)) {
        if (row.node_id && row.value_text) {
            const parsedId = parseInt(row.value_text, 10);
            if (!isNaN(parsedId) && parsedId > 0)
                tmdbIdMap.set(row.node_id, parsedId);
        }
    }
    // 4. Récupérer et classer tous les médias par priorité algorithmique
    const allNodes = await db.query.mediaNodes.findMany();
    const scoredNodes = allNodes
        .map((node) => ({
        node,
        score: computeMetadataNeedScore(node, tagCountMap.get(node.id) || 0, crewCountMap.get(node.id) || { directors: 0, actors: 0 }),
    }))
        .sort((a, b) => b.score - a.score);
    const targetBatch = scoredNodes.slice(0, batchLimit);
    let enrichedCount = 0;
    for (const { node } of targetBatch) {
        try {
            let hasUpdate = false;
            const updates = { updatedAt: new Date() };
            // Assainissement immédiat du titre : suppression des années (YYYY) résiduelles et préfixes 01
            const cleanTitle = sanitizeReleaseTags(node.title);
            if (cleanTitle && cleanTitle !== node.title) {
                updates.title = cleanTitle;
                hasUpdate = true;
            }
            // Réconciliation intelligente de l'année si discordante avec le nom de fichier
            const detectedYear = extractYearFromText(node.title) || extractYearFromText(node.videoFilePath) || extractYearFromText(node.nfoFilePath);
            if (detectedYear && node.releaseYear && Math.abs(detectedYear - node.releaseYear) > 1 && node.nodeType === 'MOVIE') {
                updates.releaseYear = detectedYear;
                hasUpdate = true;
            }
            // Détection de visuels adjacents locaux (.nfo, posters)
            if ((!node.posterPath || !node.fanartPath) && node.nfoFilePath) {
                const adjacent = await detectAdjacentFiles(node.nfoFilePath);
                if (!node.posterPath && adjacent.posterPath) {
                    updates.posterPath = adjacent.posterPath;
                    hasUpdate = true;
                }
                if (!node.fanartPath && adjacent.fanartPath) {
                    updates.fanartPath = adjacent.fanartPath;
                    hasUpdate = true;
                }
                if (!node.thumbPath && adjacent.thumbPath) {
                    updates.thumbPath = adjacent.thumbPath;
                    hasUpdate = true;
                }
            }
            let rawSearch = cleanTitle || node.originalTitle || node.title;
            const parentId = node.parentId;
            if ((node.nodeType === 'EPISODE' || node.nodeType === 'SEASON') && parentId) {
                const parent = await db.query.mediaNodes.findFirst({
                    where: (t, { eq: eqOp }) => eqOp(t.id, parentId),
                });
                if (parent?.title)
                    rawSearch = parent.title;
            }
            const searchTitle = cleanShowTitle(rawSearch);
            const knownTmdbId = tmdbIdMap.get(node.id);
            const external = await fetchExternalMetadata(searchTitle, node.nodeType, knownTmdbId ? { tmdb: knownTmdbId } : undefined);
            if (external) {
                if (external.translations) {
                    updates.translationsJson = external.translations;
                    hasUpdate = true;
                }
                if ((!node.overview || node.overview.trim().length === 0) && external.overview) {
                    updates.overview = external.overview;
                    hasUpdate = true;
                }
                if (!node.tagline && external.tagline) {
                    updates.tagline = external.tagline;
                    hasUpdate = true;
                }
                if ((!node.releaseYear || (detectedYear && Math.abs(node.releaseYear - detectedYear) > 1)) && external.releaseYear) {
                    updates.releaseYear = external.releaseYear;
                    hasUpdate = true;
                }
                if (node.communityRating == null && external.communityRating) {
                    updates.communityRating = external.communityRating;
                    hasUpdate = true;
                }
                if (!node.posterPath && external.posterUrl) {
                    updates.posterPath = external.posterUrl;
                    hasUpdate = true;
                }
                if (!node.fanartPath && external.fanartUrl) {
                    updates.fanartPath = external.fanartUrl;
                    hasUpdate = true;
                }
                // Tags thématiques & descriptifs
                for (const g of external.genres) {
                    await linkTagToNode(node.id, 'genre', g).catch(() => null);
                }
                for (const s of external.tags) {
                    await linkTagToNode(node.id, 'subject', s).catch(() => null);
                }
                for (const st of external.studios) {
                    await linkTagToNode(node.id, 'studio', st).catch(() => null);
                }
                for (const c of external.countries) {
                    await linkTagToNode(node.id, 'country', c).catch(() => null);
                }
                if (external.certification) {
                    await linkTagToNode(node.id, 'certification', external.certification).catch(() => null);
                }
                // Équipes artistiques et humaines (Réalisateur, Scénariste, Acteurs)
                for (const d of external.directors) {
                    await linkTagToNode(node.id, 'director', d).catch(() => null);
                }
                for (const w of external.writers) {
                    await linkTagToNode(node.id, 'writer', w).catch(() => null);
                }
                for (const p of external.producers) {
                    await linkTagToNode(node.id, 'producer', p).catch(() => null);
                }
                for (const comp of external.composers) {
                    await linkTagToNode(node.id, 'composer', comp).catch(() => null);
                }
                for (const a of external.actors) {
                    await linkTagToNode(node.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(() => null);
                }
                if (node.nodeType === 'MOVIE' && external.collection) {
                    const colNode = await findOrCreateCollectionNode(external.collection.name, external.collection);
                    if (colNode && node.parentId !== colNode.id) {
                        updates.parentId = colNode.id;
                        hasUpdate = true;
                    }
                }
            }
            // Traitement spécial et agressif pour les Sagas (COLLECTION) : enrichir également ses films enfants
            if (node.nodeType === 'COLLECTION') {
                const childMovies = await db.query.mediaNodes.findMany({
                    where: (t, { eq: eqOp }) => eqOp(t.parentId, node.id),
                });
                for (const child of childMovies) {
                    const childCrew = crewCountMap.get(child.id) || { directors: 0, actors: 0 };
                    const childTagCount = tagCountMap.get(child.id) || 0;
                    // Si le film enfant manque de réalisateur, de casting ou de tags, on l'enrichit immédiatement
                    if (!child.overview || childTagCount < 10 || childCrew.directors === 0) {
                        const cleanChild = cleanShowTitle(sanitizeReleaseTags(child.originalTitle || child.title));
                        const childTmdbId = tmdbIdMap.get(child.id);
                        const childExt = await fetchExternalMetadata(cleanChild, 'MOVIE', childTmdbId ? { tmdb: childTmdbId } : undefined);
                        if (childExt) {
                            const childUpdates = { updatedAt: new Date() };
                            if (childExt.translations) {
                                childUpdates.translationsJson = childExt.translations;
                            }
                            const cleanChildTitle = sanitizeReleaseTags(child.title);
                            if (cleanChildTitle && cleanChildTitle !== child.title) {
                                childUpdates.title = cleanChildTitle;
                            }
                            if (!child.overview && childExt.overview)
                                childUpdates.overview = childExt.overview;
                            if (!child.tagline && childExt.tagline)
                                childUpdates.tagline = childExt.tagline;
                            if (childExt.releaseYear && (!child.releaseYear || child.releaseYear > childExt.releaseYear)) {
                                childUpdates.releaseYear = childExt.releaseYear;
                            }
                            if (child.communityRating == null && childExt.communityRating) {
                                childUpdates.communityRating = childExt.communityRating;
                            }
                            if (!child.posterPath && childExt.posterUrl)
                                childUpdates.posterPath = childExt.posterUrl;
                            if (!child.fanartPath && childExt.fanartUrl)
                                childUpdates.fanartPath = childExt.fanartUrl;
                            if (Object.keys(childUpdates).length > 1) {
                                await db.update(mediaNodes).set(childUpdates).where(eq(mediaNodes.id, child.id));
                            }
                            // Lier les tags complets au film enfant (qui remonteront dans la saga)
                            for (const g of childExt.genres)
                                await linkTagToNode(child.id, 'genre', g).catch(() => null);
                            for (const s of childExt.tags)
                                await linkTagToNode(child.id, 'subject', s).catch(() => null);
                            for (const st of childExt.studios)
                                await linkTagToNode(child.id, 'studio', st).catch(() => null);
                            for (const c of childExt.countries)
                                await linkTagToNode(child.id, 'country', c).catch(() => null);
                            if (childExt.certification) {
                                await linkTagToNode(child.id, 'certification', childExt.certification).catch(() => null);
                            }
                            for (const d of childExt.directors)
                                await linkTagToNode(child.id, 'director', d).catch(() => null);
                            for (const w of childExt.writers)
                                await linkTagToNode(child.id, 'writer', w).catch(() => null);
                            for (const p of childExt.producers)
                                await linkTagToNode(child.id, 'producer', p).catch(() => null);
                            for (const comp of childExt.composers)
                                await linkTagToNode(child.id, 'composer', comp).catch(() => null);
                            for (const a of childExt.actors) {
                                await linkTagToNode(child.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(() => null);
                            }
                        }
                        await new Promise((resolve) => setTimeout(resolve, 150));
                    }
                }
            }
            if (hasUpdate) {
                await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, node.id));
                enrichedCount++;
            }
            // Pause de 150ms pour éviter tout blocage 429 Too Many Requests
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
        catch (nodeErr) {
            console.warn(`Enrichment skipped for media ${node.id}:`, nodeErr);
        }
    }
    return { processedCount: targetBatch.length, enrichedCount };
}
