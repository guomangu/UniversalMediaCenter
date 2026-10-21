import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '../db/connection.js';
import { mediaNodes, nodeEavLinks } from '../db/schema/index.js';
import { eq, and, ne, isNull, sql, inArray } from 'drizzle-orm';
import { resolveParentShowNodeId, resolveSeriesRoot, findOrCreateCollectionNode, cleanShowFolderName, detectSagaNameFromFolder } from './hierarchyResolver.js';
import { analyzeFolderGrouping, isExtraMediaFile } from './folderGrouper.js';
import { parseSeasonEpisode } from './seasonEpisodeHelper.js';
import { sanitizeReleaseTags, extractYearFromText, extractCanonicalShowTitle, normalizePhoneticSpelling } from './titleCleaner.js';
import { fetchExternalMetadata } from './externalMetadata.js';
import { generateSlug } from './slugify.js';
import { linkTagToNode } from './tagExtractor.js';
/**
 * Réconcilie et répare de façon déterministe toute la hiérarchie des séries, saisons, épisodes ET sagas
 */
export async function repairAllMediaHierarchy() {
    const report = {
        inspected: 0,
        reparented: 0,
        fixedOrders: 0,
        cleanedExtras: 0,
        cleanedOrphans: 0,
        healedShows: 0,
        moviesLinkedToSagas: 0,
        requalifiedEpisodes: 0,
        requalifiedMovies: 0,
        consolidatedShows: 0,
        phantomShowsRemoved: 0,
    };
    // 1. Nettoyer les noeuds de type SEASON et retirer tout videoFilePath erroné sur les SHOWs
    await db.execute(sql `
    DELETE FROM media_nodes WHERE node_type = 'SEASON';
    UPDATE media_nodes SET video_file_path = NULL WHERE node_type = 'SHOW' AND video_file_path IS NOT NULL;
  `);
    // 2a. Guérison des SHOWs corrompus avec le titre erroné "Épisode -1"
    const corruptedShows = await db.query.mediaNodes.findMany({
        where: (t, { and: aOp, eq: eOp }) => aOp(eOp(t.nodeType, 'SHOW'), eOp(t.title, 'Épisode -1')),
    });
    for (const show of corruptedShows) {
        let recoveredTitle;
        if (show.nfoFilePath) {
            try {
                const content = await fs.readFile(show.nfoFilePath, 'utf-8');
                const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    recoveredTitle = titleMatch[1].trim();
                }
            }
            catch { }
            if (!recoveredTitle) {
                recoveredTitle = cleanShowFolderName(path.basename(path.dirname(show.nfoFilePath)));
            }
        }
        if (recoveredTitle && recoveredTitle !== 'Épisode -1') {
            const cleanSort = recoveredTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || recoveredTitle;
            const baseSlug = generateSlug(recoveredTitle) || 'show';
            await db
                .update(mediaNodes)
                .set({
                title: recoveredTitle,
                sortTitle: cleanSort,
                slug: `${baseSlug}-show-${Date.now().toString().slice(-4)}`,
                updatedAt: new Date(),
            })
                .where(eq(mediaNodes.id, show.id));
            report.healedShows++;
        }
    }
    // 2b. Restauration de Soul Eater (si renommé par collision en "Soul")
    const soulEaterCorrupted = await db.query.mediaNodes.findMany({
        where: (t, { and: aOp, eq: eOp }) => aOp(eOp(t.nodeType, 'SHOW'), eOp(t.title, 'Soul')),
    });
    for (const show of soulEaterCorrupted) {
        const hasSoulEaterEp = await db.query.mediaNodes.findFirst({
            where: (t, { and: aOp, eq: eOp, sql: sOp }) => aOp(eOp(t.parentId, show.id), eOp(t.nodeType, 'EPISODE'), sql `${t.videoFilePath} ILIKE '%Soul Eater%' OR ${t.title} ILIKE '%Soul Eater%'`),
        });
        if (hasSoulEaterEp) {
            await db
                .update(mediaNodes)
                .set({
                title: 'Soul Eater',
                sortTitle: 'Soul Eater',
                originalTitle: 'ソウルイーター',
                updatedAt: new Date(),
            })
                .where(eq(mediaNodes.id, show.id));
            report.healedShows++;
        }
    }
    // 2c. Nettoyage spécifique des faux SHOWs parasites pour Mon Voisin Totoro et Antigang
    await db.execute(sql `
    DELETE FROM node_eav_links WHERE node_id IN (
      SELECT id FROM media_nodes 
      WHERE node_type = 'SHOW' 
      AND title IN ('Mon Voisin Totoro', 'Antigang') 
      AND video_file_path IS NULL 
      AND nfo_file_path IS NULL
    );
    DELETE FROM media_nodes 
    WHERE node_type = 'SHOW' 
    AND title IN ('Mon Voisin Totoro', 'Antigang') 
    AND video_file_path IS NULL 
    AND nfo_file_path IS NULL;
  `);
    // Rattacher le film Totoro à la Saga Ghibli
    const ghibliSaga = await findOrCreateCollectionNode('Studio Ghibli - Saga');
    if (ghibliSaga) {
        await db.execute(sql `
      UPDATE media_nodes SET parent_id = ${ghibliSaga.id}::uuid, updated_at = NOW()
      WHERE node_type = 'MOVIE' AND (title ILIKE '%totoro%' OR video_file_path ILIKE '%totoro%');
    `);
    }
    // Rattacher le film Antigang à la Saga Antigang
    const antigangSaga = await findOrCreateCollectionNode('Antigang - Saga');
    if (antigangSaga) {
        await db.execute(sql `
      UPDATE media_nodes SET parent_id = ${antigangSaga.id}::uuid, updated_at = NOW()
      WHERE node_type = 'MOVIE' AND (title ILIKE '%antigang%' OR video_file_path ILIKE '%antigang%');
    `);
    }
    // 3a. Requalification des faux films (MOVIE) portant des codes formels d'épisodes (SxxExx, Saison X)
    // UNIQUEMENT s'ils sont situés dans un contexte formel de série télévisée
    const misclassifiedMovies = await db.query.mediaNodes.findMany({
        where: (t, { eq: eOp }) => eOp(t.nodeType, 'MOVIE'),
    });
    for (const movieNode of misclassifiedMovies) {
        const filePath = movieNode.videoFilePath || movieNode.nfoFilePath || '';
        if (!filePath)
            continue;
        // Ne JAMAIS requalifier un fichier situé dans un dossier de film ou saga
        const isFilmDir = /\/(?:films?|movies?)\//i.test(filePath) && !/(?:peaky blinders|papacito)/i.test(filePath);
        const isSagaDir = detectSagaNameFromFolder(filePath) !== null;
        const seriesCtx = await resolveSeriesRoot(filePath);
        if (isFilmDir || isSagaDir || !seriesCtx) {
            continue;
        }
        const fileName = path.basename(filePath);
        const hasEpCode = /S\d+[\s._-]*E\d+/i.test(movieNode.title) ||
            /S\d+[\s._-]*E\d+/i.test(fileName) ||
            /(?:^|\/|[ _-])(?:saison|season)\s*\d+/i.test(filePath);
        if (hasEpCode) {
            const seMatch = movieNode.title.match(/S(\d+)[\s._-]*E(\d+)/i) ||
                fileName.match(/S(\d+)[\s._-]*E(\d+)/i) ||
                filePath.match(/S(\d+)[\s._-]*E(\d+)/i);
            let effSeason = seMatch ? parseInt(seMatch[1], 10) : undefined;
            let effEpisode = seMatch ? parseInt(seMatch[2], 10) : undefined;
            if (effSeason === undefined || effEpisode === undefined) {
                const xMatch = movieNode.title.match(/\b([0-9]{1,2})x([0-9]{1,3})\b/i) || fileName.match(/\b([0-9]{1,2})x([0-9]{1,3})\b/i);
                if (xMatch && parseInt(xMatch[1], 10) < 50 && parseInt(xMatch[2], 10) < 100) {
                    effSeason = parseInt(xMatch[1], 10);
                    effEpisode = parseInt(xMatch[2], 10);
                }
            }
            if (effSeason === undefined) {
                const sFolderMatch = filePath.match(/(?:saison|season)\s*0*(\d{1,2})/i);
                if (sFolderMatch)
                    effSeason = parseInt(sFolderMatch[1], 10);
            }
            effSeason = effSeason || 1;
            effEpisode = effEpisode || 1;
            const orderIndex = effSeason > 1 ? effSeason * 1000 + effEpisode : effEpisode;
            const targetParentId = await resolveParentShowNodeId(filePath);
            await db
                .update(mediaNodes)
                .set({
                nodeType: 'EPISODE',
                parentId: targetParentId,
                orderIndex,
                absoluteOrderIndex: effEpisode,
                title: sanitizeReleaseTags(movieNode.title),
                sortTitle: sanitizeReleaseTags(movieNode.title),
                updatedAt: new Date(),
            })
                .where(eq(mediaNodes.id, movieNode.id));
            movieNode.nodeType = 'EPISODE';
            movieNode.parentId = targetParentId;
            movieNode.orderIndex = orderIndex;
            report.requalifiedEpisodes++;
            report.reparented++;
        }
    }
    // 3b. Requalification INVERSE : Restauration des films faussement déclassés en EPISODE
    const allEpisodes = await db.query.mediaNodes.findMany({
        where: (t, { eq: eOp }) => eOp(t.nodeType, 'EPISODE'),
    });
    for (const epNode of allEpisodes) {
        const filePath = epNode.videoFilePath || epNode.nfoFilePath || '';
        if (!filePath)
            continue;
        const fileName = path.basename(filePath);
        const hasFormalEpisodeCode = /S\d+[\s._-]*E\d+/i.test(epNode.title) ||
            /S\d+[\s._-]*E\d+/i.test(fileName) ||
            /(?:saison|season)\s*\d+/i.test(filePath);
        const isInsideFilmDirectory = /\/(?:films?|movies?)\//i.test(filePath);
        const isGhostInTheShellMovie = filePath.includes('ghost in the shell') && (filePath.includes('/a. movies') || filePath.includes('the new movie'));
        const isPixarMovie = filePath.includes('The Pixar-Disney Animations Collection') || filePath.includes('Pixar Short Films Collection');
        // Vérifier si ce n'est pas une vraie série située par erreur dans un dossier film
        const isActualSeries = /(?:peaky blinders|papacito)/i.test(filePath);
        if (!isActualSeries && (!hasFormalEpisodeCode || isGhostInTheShellMovie || isPixarMovie)) {
            if (isInsideFilmDirectory || isGhostInTheShellMovie || isPixarMovie) {
                // C'est un FILM !
                const cleanTitle = sanitizeReleaseTags(epNode.title);
                let targetCollectionId = null;
                const sagaName = detectSagaNameFromFolder(filePath);
                if (sagaName) {
                    const colNode = await findOrCreateCollectionNode(sagaName);
                    if (colNode)
                        targetCollectionId = colNode.id;
                }
                await db
                    .update(mediaNodes)
                    .set({
                    nodeType: 'MOVIE',
                    parentId: targetCollectionId,
                    title: cleanTitle,
                    sortTitle: cleanTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || cleanTitle,
                    orderIndex: epNode.releaseYear || 0,
                    absoluteOrderIndex: null,
                    updatedAt: new Date(),
                })
                    .where(eq(mediaNodes.id, epNode.id));
                report.requalifiedMovies++;
            }
        }
    }
    // 3c. Unification et Restauration Canonique de Ghost in the Shell
    const gitsSaga = await findOrCreateCollectionNode('Ghost in the Shell - Saga');
    if (gitsSaga) {
        // 1. Tous les films Ghost in the Shell rattachés à la saga
        await db.execute(sql `
      UPDATE media_nodes SET 
        node_type = 'MOVIE',
        parent_id = ${gitsSaga.id}::uuid,
        updated_at = NOW()
      WHERE (video_file_path ILIKE '%ghost in the shell%a. movies%' OR video_file_path ILIKE '%ghost in the shell%the new movie%');
    `);
        // 2. Unifier Stand Alone Complex en un seul Master SHOW
        let sacShow = await db.query.mediaNodes.findFirst({
            where: (t, { and: aOp, eq: eOp, sql: sOp }) => aOp(eOp(t.nodeType, 'SHOW'), sql `${t.title} ILIKE '%Stand Alone Complex%' OR ${t.title} ILIKE '%(S A C)%'`),
        });
        if (!sacShow) {
            const sacSlug = `ghost-in-the-shell-sac-${Date.now().toString().slice(-4)}`;
            const [newSac] = await db
                .insert(mediaNodes)
                .values({
                nodeType: 'SHOW',
                title: 'Ghost in the Shell: Stand Alone Complex',
                sortTitle: 'Ghost in the Shell: Stand Alone Complex',
                slug: sacSlug,
                state: 'READY',
                parentId: gitsSaga.id,
                overview: "Dans un futur cyberpunk, la section 9 de la sécurité publique enquête sur les cybercrimes et le terrorisme technologique.",
                updatedAt: new Date(),
            })
                .returning();
            sacShow = newSac;
        }
        else {
            await db
                .update(mediaNodes)
                .set({
                title: 'Ghost in the Shell: Stand Alone Complex',
                sortTitle: 'Ghost in the Shell: Stand Alone Complex',
                parentId: gitsSaga.id,
                updatedAt: new Date(),
            })
                .where(eq(mediaNodes.id, sacShow.id));
        }
        // Rattacher tous les épisodes et OVAs SAC au master SHOW
        if (sacShow) {
            await db.execute(sql `
        UPDATE media_nodes SET 
          parent_id = ${sacShow.id}::uuid,
          node_type = 'EPISODE',
          updated_at = NOW()
        WHERE video_file_path ILIKE '%ghost in the shell%stand alone complex%';
      `);
        }
        // 3. Unifier Arise en un seul Master SHOW
        let ariseShow = await db.query.mediaNodes.findFirst({
            where: (t, { and: aOp, eq: eOp, sql: sOp }) => aOp(eOp(t.nodeType, 'SHOW'), sql `${t.title} ILIKE '%Arise%'`),
        });
        if (!ariseShow) {
            const ariseSlug = `ghost-in-the-shell-arise-${Date.now().toString().slice(-4)}`;
            const [newArise] = await db
                .insert(mediaNodes)
                .values({
                nodeType: 'SHOW',
                title: 'Ghost in the Shell: Arise',
                sortTitle: 'Ghost in the Shell: Arise',
                slug: ariseSlug,
                state: 'READY',
                parentId: gitsSaga.id,
                overview: "Préquelle retraçant la formation de la section 9 et le passé de Motoko Kusanagi.",
                updatedAt: new Date(),
            })
                .returning();
            ariseShow = newArise;
        }
        else {
            await db
                .update(mediaNodes)
                .set({
                title: 'Ghost in the Shell: Arise',
                sortTitle: 'Ghost in the Shell: Arise',
                parentId: gitsSaga.id,
                updatedAt: new Date(),
            })
                .where(eq(mediaNodes.id, ariseShow.id));
        }
        // Rattacher les épisodes Arise au master SHOW (hors the new movie qui est un film)
        if (ariseShow) {
            await db.execute(sql `
        UPDATE media_nodes SET 
          parent_id = ${ariseShow.id}::uuid,
          node_type = 'EPISODE',
          updated_at = NOW()
        WHERE video_file_path ILIKE '%ghost in the shell%arise%' 
        AND video_file_path NOT ILIKE '%the new movie%';
      `);
        }
    }
    // 4. Déduplication et consolidation canonique des SHOWs fragmentés ("Peaky Blinders - Saison 1 360p", etc.)
    const allShows = await db.query.mediaNodes.findMany({
        where: (t, { eq: eOp }) => eOp(t.nodeType, 'SHOW'),
    });
    const showGroups = new Map();
    for (const show of allShows) {
        const canonical = extractCanonicalShowTitle(show.title);
        const phoneticKey = normalizePhoneticSpelling(canonical).toLowerCase().trim() || canonical.toLowerCase().trim();
        if (!showGroups.has(phoneticKey))
            showGroups.set(phoneticKey, []);
        showGroups.get(phoneticKey).push(show);
    }
    for (const [key, group] of showGroups.entries()) {
        if (group.length <= 1)
            continue;
        const canonicalTitle = extractCanonicalShowTitle(group[0].title) || group[0].title;
        // Déterminer ou promouvoir le Master SHOW
        let masterShow = group.find((s) => s.posterPath && s.communityRating);
        if (!masterShow) {
            masterShow = group.find((s) => s.title.toLowerCase().trim() === canonicalTitle.toLowerCase().trim());
        }
        if (!masterShow) {
            masterShow = group[0];
            await db
                .update(mediaNodes)
                .set({
                title: canonicalTitle,
                sortTitle: canonicalTitle,
                updatedAt: new Date(),
            })
                .where(eq(mediaNodes.id, masterShow.id));
            masterShow.title = canonicalTitle;
            masterShow.sortTitle = canonicalTitle;
        }
        // Reparenter tous les enfants des faux SHOWs secondaires vers le master
        for (const otherShow of group) {
            if (otherShow.id === masterShow.id)
                continue;
            // Déplacer les épisodes
            await db
                .update(mediaNodes)
                .set({ parentId: masterShow.id, updatedAt: new Date() })
                .where(eq(mediaNodes.parentId, otherShow.id));
            // Migrer les liens EAV sans violer la contrainte unique
            await db.execute(sql `
        UPDATE node_eav_links SET node_id = ${masterShow.id}::uuid
        WHERE node_id = ${otherShow.id}::uuid
        AND value_id NOT IN (
          SELECT value_id FROM node_eav_links WHERE node_id = ${masterShow.id}::uuid
        )
      `);
            await db.execute(sql `
        DELETE FROM node_eav_links WHERE node_id = ${otherShow.id}::uuid
      `);
            // Supprimer le pseudo-show devenu redondant
            await db.delete(mediaNodes).where(eq(mediaNodes.id, otherShow.id));
            report.consolidatedShows++;
        }
        // Enrichir le master SHOW avec TMDb s'il manque de métadonnées
        if (!masterShow.posterPath || !masterShow.overview) {
            try {
                const ext = await fetchExternalMetadata(canonicalTitle, 'SHOW');
                if (ext) {
                    const updates = { updatedAt: new Date() };
                    if (!masterShow.posterPath && ext.posterUrl)
                        updates.posterPath = ext.posterUrl;
                    if (!masterShow.fanartPath && ext.fanartUrl)
                        updates.fanartPath = ext.fanartUrl;
                    if (!masterShow.overview && ext.overview)
                        updates.overview = ext.overview;
                    if (!masterShow.tagline && ext.tagline)
                        updates.tagline = ext.tagline;
                    if (!masterShow.releaseYear && ext.releaseYear)
                        updates.releaseYear = ext.releaseYear;
                    if (masterShow.communityRating == null && ext.communityRating)
                        updates.communityRating = ext.communityRating;
                    await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, masterShow.id));
                    for (const a of ext.actors || []) {
                        await linkTagToNode(masterShow.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(() => null);
                    }
                    for (const d of ext.directors || []) {
                        await linkTagToNode(masterShow.id, 'director', d).catch(() => null);
                    }
                    for (const g of ext.genres || []) {
                        await linkTagToNode(masterShow.id, 'genre', g).catch(() => null);
                    }
                }
            }
            catch { }
        }
    }
    // 4b. Suppression systématique des SHOWs fantômes sans fichier physique ET sans aucun épisode
    const deletedPhantoms = await db.execute(sql `
    DELETE FROM node_eav_links WHERE node_id IN (
      SELECT id FROM media_nodes 
      WHERE node_type = 'SHOW' 
      AND nfo_file_path IS NULL 
      AND video_file_path IS NULL 
      AND id NOT IN (
        SELECT DISTINCT parent_id FROM media_nodes 
        WHERE parent_id IS NOT NULL AND node_type = 'EPISODE'
      )
    );

    DELETE FROM media_nodes 
    WHERE node_type = 'SHOW' 
    AND nfo_file_path IS NULL 
    AND video_file_path IS NULL 
    AND id NOT IN (
      SELECT DISTINCT parent_id FROM media_nodes 
      WHERE parent_id IS NOT NULL AND node_type = 'EPISODE'
    );
  `);
    report.phantomShowsRemoved += Number((deletedPhantoms.count || deletedPhantoms.rowCount) || 0);
    // 5. Récupérer tous les noeuds médias locaux non-LIVE pour vérification d'intégrité
    const allNodes = await db.query.mediaNodes.findMany({
        where: (t, { ne: neOp }) => neOp(t.nodeType, 'LIVE_CHANNEL'),
    });
    for (const node of allNodes) {
        if (node.nodeType === 'SHOW' || node.nodeType === 'COLLECTION') {
            continue;
        }
        const filePath = node.nfoFilePath || node.videoFilePath;
        if (!filePath || filePath.startsWith('http://') || filePath.startsWith('https://')) {
            continue;
        }
        // Requalification des bonus / coulisses / samples en EXTRA
        if (isExtraMediaFile(filePath) && (node.nodeType !== 'EXTRA' || !node.isExtra)) {
            await db
                .update(mediaNodes)
                .set({
                nodeType: 'EXTRA',
                isExtra: true,
                updatedAt: new Date(),
            })
                .where(eq(mediaNodes.id, node.id));
            node.nodeType = 'EXTRA';
            node.isExtra = true;
        }
        // Ignorer les fichiers de trickplay résiduels
        if (filePath.includes('/.trickplay/') || filePath.endsWith('.bif')) {
            await db.delete(mediaNodes).where(eq(mediaNodes.id, node.id));
            report.cleanedOrphans++;
            continue;
        }
        // Réparation des titres corrompus résiduels (ex: "]" ou "[")
        if (node.title === "]" || node.title === "[" || (node.title && node.title.trim().length <= 1)) {
            const fixedTitle = sanitizeReleaseTags(path.basename(filePath, path.extname(filePath)));
            if (fixedTitle && fixedTitle !== "]" && fixedTitle !== "[") {
                await db.update(mediaNodes).set({ title: fixedTitle, updatedAt: new Date() }).where(eq(mediaNodes.id, node.id));
                node.title = fixedTitle;
            }
        }
        report.inspected++;
        // A. Si c'est un film (MOVIE) :
        // - Défaire tout parentId erroné pointant vers un SHOW (un film ne doit JAMAIS dépendre d'un SHOW !)
        // - Rattacher à une COLLECTION (Saga) si détectée
        if (node.nodeType === 'MOVIE') {
            const movieUpdates = {};
            if (node.parentId) {
                const parentNode = await db.query.mediaNodes.findFirst({
                    where: (t, { eq: eqOp }) => eqOp(t.id, node.parentId),
                });
                if (parentNode && parentNode.nodeType === 'SHOW') {
                    movieUpdates.parentId = null;
                    node.parentId = null;
                }
            }
            if (node.nfoFilePath) {
                try {
                    const content = await fs.readFile(node.nfoFilePath, 'utf-8');
                    const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
                    if (titleMatch && titleMatch[1]) {
                        const rawTitle = titleMatch[1].trim();
                        const cleanTitle = sanitizeReleaseTags(rawTitle);
                        if (cleanTitle && cleanTitle !== node.title && !/1080p|720p|x264|bluray/i.test(cleanTitle)) {
                            movieUpdates.title = cleanTitle;
                            movieUpdates.sortTitle = cleanTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || cleanTitle;
                        }
                    }
                    if (!node.parentId) {
                        const setMatch = content.match(/<set[^>]*>[\s\S]*?<name>([^<]+)<\/name>/i) || content.match(/<set[^>]*>([^<]+)<\/set>/i);
                        const colName = setMatch ? setMatch[1]?.trim() : undefined;
                        if (colName) {
                            const colNode = await findOrCreateCollectionNode(colName);
                            if (colNode) {
                                const movieYear = node.releaseYear || (node.premieredDate ? new Date(node.premieredDate).getFullYear() : 0);
                                movieUpdates.parentId = colNode.id;
                                movieUpdates.orderIndex = movieYear || node.orderIndex;
                                report.moviesLinkedToSagas++;
                                node.parentId = colNode.id;
                            }
                        }
                    }
                }
                catch { }
            }
            // Rattachement par dossier si aucune balise <set> n'était présente
            if (!node.parentId) {
                const folderSaga = detectSagaNameFromFolder(filePath);
                if (folderSaga) {
                    const colNode = await findOrCreateCollectionNode(folderSaga);
                    if (colNode) {
                        const movieYear = node.releaseYear || (node.premieredDate ? new Date(node.premieredDate).getFullYear() : 0);
                        movieUpdates.parentId = colNode.id;
                        movieUpdates.orderIndex = movieYear || node.orderIndex;
                        report.moviesLinkedToSagas++;
                        node.parentId = colNode.id;
                    }
                }
            }
            if (Object.keys(movieUpdates).length > 0) {
                movieUpdates.updatedAt = new Date();
                await db.update(mediaNodes).set(movieUpdates).where(eq(mediaNodes.id, node.id));
            }
            continue;
        }
        // B. Pour les épisodes : résolution du vrai SHOW parent
        const legitimateParentId = await resolveParentShowNodeId(filePath);
        const seriesCtx = await resolveSeriesRoot(filePath);
        let needsUpdate = false;
        const updates = { updatedAt: new Date() };
        if (legitimateParentId && legitimateParentId !== node.parentId) {
            updates.parentId = legitimateParentId;
            needsUpdate = true;
            report.reparented++;
        }
        if (seriesCtx) {
            const grouping = analyzeFolderGrouping(filePath, seriesCtx.showDir);
            // Correction des faux extras
            if (grouping.isExtra) {
                if (!node.isExtra) {
                    updates.isExtra = true;
                    updates.extraType = grouping.extraType || 'featurette';
                    needsUpdate = true;
                }
            }
            else if (node.isExtra) {
                updates.isExtra = false;
                updates.extraType = null;
                needsUpdate = true;
                report.cleanedExtras++;
            }
            if (grouping.isMovie && node.nodeType !== 'MOVIE') {
                updates.nodeType = 'MOVIE';
                needsUpdate = true;
            }
            // Vérification et recalcul de l'index d'ordre et de l'index absolu pour éviter toute collision
            const seInfo = parseSeasonEpisode(node.title, node.orderIndex);
            const effSeason = grouping.seasonNumber ?? seInfo?.season ?? (node.orderIndex >= 1000 ? Math.floor(node.orderIndex / 1000) : 1);
            const effEpisode = seInfo?.episode ?? (node.orderIndex >= 1000 ? node.orderIndex % 1000 : (node.absoluteOrderIndex ?? node.orderIndex));
            let targetOrder = node.orderIndex;
            let targetAbsolute = node.absoluteOrderIndex;
            if (effSeason > 1 && effSeason < 990 && effEpisode > 0) {
                targetOrder = effSeason * 1000 + effEpisode;
                targetAbsolute = effEpisode;
            }
            else if (effSeason === 1 && effEpisode > 0) {
                targetOrder = effEpisode;
                targetAbsolute = effEpisode;
            }
            else if (effSeason === 998 && effEpisode > 0) {
                targetOrder = 998000 + effEpisode;
                targetAbsolute = effEpisode;
            }
            if (targetOrder !== node.orderIndex) {
                updates.orderIndex = targetOrder;
                needsUpdate = true;
                report.fixedOrders++;
            }
            if (targetAbsolute !== node.absoluteOrderIndex) {
                updates.absoluteOrderIndex = targetAbsolute;
                needsUpdate = true;
            }
        }
        if (needsUpdate) {
            await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, node.id));
        }
    }
    // 6. Rattachement des Méta-Franchises & Univers Partagés (Terre du Milieu, Rockyverse...)
    const allCollections = await db.query.mediaNodes.findMany({
        where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'COLLECTION'),
    });
    // LOTR + Hobbit => Univers Terre du Milieu (Middle-Earth).
    // La détection part des FILMS eux-mêmes : exiger au préalable l'existence
    // d'une collection LOTR/Hobbit rendait la réparation inopérante après la
    // suppression d'une saga vide (le parent_id des films passait à NULL via
    // ON DELETE SET NULL, et plus rien ne recréait l'univers).
    const lotrHobbitRegex = /(seigneur des anneaux|lord of the rings|hobbit|terre du milieu)/i;
    const middleEarthMovies = await db.query.mediaNodes.findMany({
        where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'MOVIE'),
        columns: { id: true, title: true, originalTitle: true, parentId: true, videoFilePath: true },
    });
    const middleEarthMatches = middleEarthMovies.filter((movie) => lotrHobbitRegex.test(movie.title) ||
        lotrHobbitRegex.test(movie.originalTitle || '') ||
        lotrHobbitRegex.test(movie.videoFilePath || ''));
    if (middleEarthMatches.length >= 2) {
        const universeTitle = 'Univers Terre du Milieu - Saga';
        let universeNode = allCollections.find((c) => c.title.toLowerCase() === universeTitle.toLowerCase());
        if (!universeNode) {
            const uSlug = `univers-terre-du-milieu-collection-${Date.now().toString().slice(-4)}`;
            const [createdUni] = await db
                .insert(mediaNodes)
                .values({
                nodeType: 'COLLECTION',
                title: universeTitle,
                sortTitle: 'Terre du Milieu',
                slug: uSlug,
                state: 'READY',
                confidenceScore: 1.0,
                overview: "L'univers étendu complet de la Terre du Milieu imaginé par J.R.R. Tolkien, comprenant la trilogie du Seigneur des Anneaux et la trilogie du Hobbit.",
                updatedAt: new Date(),
            })
                .returning();
            universeNode = createdUni;
        }
        if (universeNode) {
            for (const movie of middleEarthMatches) {
                if (movie.parentId !== universeNode.id) {
                    await db
                        .update(mediaNodes)
                        .set({ parentId: universeNode.id, updatedAt: new Date() })
                        .where(eq(mediaNodes.id, movie.id));
                    report.moviesLinkedToSagas++;
                }
            }
        }
    }
    return report;
}
