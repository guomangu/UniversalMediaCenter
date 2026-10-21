import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, ne, isNull, or, like } from 'drizzle-orm';
import { generateSlug } from './slugify.js';
import { linkTagToNode } from './tagExtractor.js';
import { calculateOSHash, extractCrc32 } from './pipeline/binaryFingerprint.js';
import { computeBinaryFootprint } from './pipeline/binaryHasher.js';
import { inspectContainerMetadata } from './pipeline/containerInspector.js';
import { analyzeSubtitlesNlp } from './pipeline/subtitleNlpMatcher.js';
import { probeMediaFile } from './pipeline/ffprobeProbe.js';
import { parseLexicalFilename } from './pipeline/lexicalParser.js';
import { identifyVideoFile } from './pipeline/universalScanner.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';
import { resolveSeriesRoot, resolveParentShowNodeId, findOrCreateCollectionNode, detectSagaNameFromFolder } from './hierarchyResolver.js';
import { analyzeFolderGrouping, isExtraMediaFile } from './folderGrouper.js';
import { sanitizeReleaseTags, extractYearFromText, extractCanonicalShowTitle } from './titleCleaner.js';
import { parsePathWithGuessit } from './pipeline/guessitParser.js';
import { isAnimeMedia, resolveAnimeSeasonEpisode } from './pipeline/animeMapping.js';
import { isKaiOrPaceMedia, parseKaiEpisodeInfo, isTaintedNfo, isTaintedArtwork } from './kaiPaceResolver.js';
export async function ingestMediaNode(nfoPath, parsed, sha256) {
    const adjacent = await detectAdjacentFiles(nfoPath);
    if (adjacent.posterPath && (await isTaintedArtwork(adjacent.posterPath))) {
        adjacent.posterPath = undefined;
    }
    if (adjacent.thumbPath && (await isTaintedArtwork(adjacent.thumbPath))) {
        adjacent.thumbPath = undefined;
    }
    // Sanctuarisation : un fichier NFO sans vidéo adjacente pour MOVIE/EPISODE/EXTRA ne doit jamais être ingéré (évite les doublons fantômes).
    // Les SHOW, SEASON et COLLECTION sont des conteneurs légitimes sans vidéo propre.
    if (!adjacent.videoFilePath &&
        parsed.type !== 'SHOW' &&
        parsed.type !== 'COLLECTION' &&
        parsed.type !== 'SEASON') {
        console.log(`⚠️ [Ingester] NFO orphelin sans vidéo ignoré pour éviter les doublons fantômes : ${nfoPath}`);
        return '';
    }
    const filePathToCheck = adjacent.videoFilePath || nfoPath;
    const isKai = isKaiOrPaceMedia(filePathToCheck, parsed.title);
    let kaiInfo = isKai ? parseKaiEpisodeInfo(filePathToCheck) : null;
    const slug = `${generateSlug(kaiInfo ? kaiInfo.title : parsed.title)}-${parsed.year || 'media'}`;
    const sortTitle = parsed.sortTitle || parsed.title;
    let parentId = null;
    let isExtra = false;
    let extraType;
    let effectiveType = parsed.type;
    let folderArcTitle = parsed.folderTitle;
    if (kaiInfo) {
        effectiveType = 'EPISODE';
        const tmdbIdCandidate = parsed.customFields?.tmdbid || parsed.customFields?.uniqueid;
        if (isTaintedNfo(parsed.title, tmdbIdCandidate) ||
            !parsed.title ||
            /guerra/i.test(parsed.title) ||
            /teatro/i.test(parsed.title) ||
            /pace/i.test(parsed.title)) {
            parsed.title = kaiInfo.title;
            parsed.showTitle = kaiInfo.showTitle;
            if (parsed.customFields) {
                if (parsed.customFields.tmdbid === '1710755')
                    delete parsed.customFields.tmdbid;
                if (parsed.customFields.uniqueid === '1710755')
                    delete parsed.customFields.uniqueid;
            }
        }
        folderArcTitle = kaiInfo.arcName;
    }
    if (parsed.type !== 'SHOW' && parsed.type !== 'COLLECTION') {
        if (isExtraMediaFile(filePathToCheck)) {
            isExtra = true;
            effectiveType = 'EXTRA';
            const grouping = analyzeFolderGrouping(filePathToCheck, path.dirname(filePathToCheck));
            extraType = grouping.extraType || 'featurette';
        }
        const seriesCtx = await resolveSeriesRoot(nfoPath);
        if (seriesCtx) {
            const grouping = analyzeFolderGrouping(nfoPath, seriesCtx.showDir);
            if (grouping.isExtra) {
                isExtra = true;
                extraType = grouping.extraType;
            }
            if (grouping.isMovie && !parsed.episodeNumber && effectiveType !== 'EPISODE' && !kaiInfo) {
                effectiveType = 'MOVIE';
            }
            if (grouping.groupTitle && !folderArcTitle) {
                folderArcTitle = grouping.groupTitle;
            }
        }
        // 1. Parsing heuristique GuessIt avec validation stricte Kyoo
        const guess = await parsePathWithGuessit(adjacent.videoFilePath || nfoPath);
        if (!kaiInfo) {
            if (guess.type === 'movie' && effectiveType !== 'COLLECTION' && effectiveType !== 'EPISODE' && !parsed.episodeNumber) {
                effectiveType = 'MOVIE';
            }
            else if (guess.type === 'episode' && effectiveType !== 'SHOW' && effectiveType !== 'COLLECTION') {
                effectiveType = 'EPISODE';
            }
        }
        if (effectiveType === 'EPISODE') {
            if (isKai) {
                const showTitleToFind = kaiInfo ? kaiInfo.showTitle : 'One Piece Kai';
                const showNode = await db.query.mediaNodes.findFirst({
                    where: (t, { and: aOp, eq: eOp, ilike: iOp }) => aOp(eOp(t.nodeType, 'SHOW'), iOp(t.title, showTitleToFind)),
                });
                if (showNode) {
                    parentId = showNode.id;
                }
                else {
                    const showSlug = `${generateSlug(showTitleToFind)}-show`;
                    const [newShow] = await db
                        .insert(mediaNodes)
                        .values({
                        nodeType: 'SHOW',
                        title: showTitleToFind,
                        sortTitle: showTitleToFind,
                        slug: `${showSlug}-${Date.now().toString().slice(-4)}`,
                        state: 'READY',
                        releaseYear: 1999,
                        overview: 'Version condensée fidèle au manga sans les scènes de remplissage.',
                    })
                        .returning();
                    parentId = newShow.id;
                }
            }
            else {
                parentId = await resolveParentShowNodeId(nfoPath);
                if (!parentId && parsed.showTitle) {
                    const canonicalShow = extractCanonicalShowTitle(parsed.showTitle);
                    const showByTitle = await db.query.mediaNodes.findFirst({
                        where: (t, { and: aOp, eq: eOp, or: oOp, ilike: iOp }) => aOp(eOp(t.nodeType, 'SHOW'), oOp(iOp(t.title, canonicalShow), iOp(t.sortTitle, canonicalShow), eOp(t.title, parsed.showTitle), eOp(t.sortTitle, parsed.showTitle))),
                    });
                    if (showByTitle)
                        parentId = showByTitle.id;
                }
            }
        }
        else if (effectiveType === 'MOVIE') {
            // Un film n'est JAMAIS rattaché à un SHOW, seulement à une COLLECTION (Saga)
            const folderSagaName = detectSagaNameFromFolder(nfoPath || adjacent.videoFilePath || '');
            if (folderSagaName) {
                const sagaNode = await findOrCreateCollectionNode(folderSagaName);
                if (sagaNode)
                    parentId = sagaNode.id;
            }
        }
        else if (effectiveType === 'SEASON') {
            // Un season.nfo est un conteneur de saison : le rattacher à son SHOW.
            parentId = await resolveParentShowNodeId(nfoPath);
        }
    }
    // Déduplication stricte et réconciliation de déplacement par chemin NFO ou vidéo
    let existing = await db.query.mediaNodes.findFirst({
        where: (t, { eq: eqOp }) => eqOp(t.nfoFilePath, nfoPath),
    });
    if (!existing && adjacent.videoFilePath) {
        existing = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eqOp }) => eqOp(t.videoFilePath, adjacent.videoFilePath),
        });
    }
    // Si non trouvé directement, vérifier si un nœud portait ce NFO ou cette vidéo avant déplacement
    if (!existing) {
        const nfoBase = path.basename(nfoPath);
        const nfoCandidates = await db.query.mediaNodes.findMany({
            where: (t, { like: lOp }) => lOp(t.nfoFilePath, `%/${nfoBase}`),
        });
        for (const c of nfoCandidates) {
            if (c.nfoFilePath && c.nfoFilePath !== nfoPath && !fs.existsSync(c.nfoFilePath)) {
                console.log(`🔁 [Ingester] NFO déplacé réconcilié pour ${nfoBase}: ${c.nfoFilePath} -> ${nfoPath}`);
                existing = c;
                break;
            }
        }
        if (!existing && adjacent.videoFilePath) {
            const vidBase = path.basename(adjacent.videoFilePath);
            const vidCandidates = await db.query.mediaNodes.findMany({
                where: (t, { like: lOp }) => lOp(t.videoFilePath, `%/${vidBase}`),
            });
            for (const c of vidCandidates) {
                if (c.videoFilePath && c.videoFilePath !== adjacent.videoFilePath && !fs.existsSync(c.videoFilePath)) {
                    console.log(`🔁 [Ingester] Vidéo adjacente déplacée réconciliée pour ${vidBase}: ${c.videoFilePath} -> ${adjacent.videoFilePath}`);
                    existing = c;
                    break;
                }
            }
        }
    }
    // Calcul d'index d'ordre unifié et sans collision entre saisons
    let orderIndex = 0;
    let absoluteOrderIndex = null;
    const guess = await parsePathWithGuessit(adjacent.videoFilePath || nfoPath);
    let effYear = parsed.year || guess.year;
    if (guess.year && (!effYear || Math.abs(effYear - guess.year) > 1)) {
        effYear = guess.year;
    }
    if (effectiveType === 'MOVIE') {
        const detectedYear = extractYearFromText(nfoPath) || extractYearFromText(adjacent.videoFilePath) || extractYearFromText(parsed.title) || guess.year;
        if (detectedYear) {
            effYear = detectedYear;
        }
        orderIndex = effYear || 0;
        absoluteOrderIndex = effYear || null;
    }
    else if (effectiveType === 'EPISODE') {
        if (kaiInfo) {
            orderIndex = kaiInfo.orderIndex;
            absoluteOrderIndex = kaiInfo.episode;
        }
        else {
            // 2. Résolution des cas complexes Animes (TheXEM & Anime-Lists)
            const showName = parsed.showTitle || guess.title;
            const candidateAbs = parsed.absoluteEpisodeNumber || guess.absoluteEpisode || (guess.episode && guess.episode > 24 ? guess.episode : undefined);
            if (candidateAbs && isAnimeMedia(showName, nfoPath)) {
                const animeRes = resolveAnimeSeasonEpisode(showName, candidateAbs, nfoPath);
                if (animeRes) {
                    orderIndex = animeRes.season * 1000 + animeRes.episode;
                    absoluteOrderIndex = animeRes.absoluteEpisode;
                }
            }
            if (!orderIndex) {
                if (parsed.absoluteEpisodeNumber != null && parsed.absoluteEpisodeNumber > 0) {
                    orderIndex = parsed.absoluteEpisodeNumber;
                    absoluteOrderIndex = parsed.absoluteEpisodeNumber;
                }
                else {
                    const effSeason = parsed.seasonNumber || guess.season || (guess.episode && guess.episode > 1000 ? Math.floor(guess.episode / 1000) : 1);
                    const effEpisode = parsed.episodeNumber || (guess.episode && guess.episode > 1000 ? guess.episode % 1000 : guess.episode) || 1;
                    if (effSeason > 1 && effSeason < 990 && effEpisode > 0) {
                        orderIndex = effSeason * 1000 + effEpisode;
                        absoluteOrderIndex = effEpisode;
                    }
                    else if (effSeason === 1 && effEpisode > 0) {
                        orderIndex = effEpisode;
                        absoluteOrderIndex = effEpisode;
                    }
                    else if (effSeason === 998 && effEpisode > 0) {
                        orderIndex = 998000 + effEpisode;
                        absoluteOrderIndex = effEpisode;
                    }
                    else if (effEpisode > 0) {
                        orderIndex = effEpisode;
                        absoluteOrderIndex = effEpisode;
                    }
                }
            }
        }
    }
    let premieredDate;
    if (parsed.premiered) {
        const d = new Date(parsed.premiered);
        if (!isNaN(d.getTime()))
            premieredDate = d;
    }
    let durationSeconds = parsed.streamDetails?.durationSeconds;
    let chapters = parsed.chapters;
    let probedQuality;
    let probedCodec;
    let oshash;
    let crc32;
    let edition;
    let probedData = null;
    if (adjacent.videoFilePath) {
        const [footprint, probed, lexical] = await Promise.all([
            computeBinaryFootprint(adjacent.videoFilePath),
            probeMediaFile(adjacent.videoFilePath),
            Promise.resolve(parseLexicalFilename(adjacent.videoFilePath)),
        ]);
        oshash = footprint.oshash || undefined;
        crc32 = (footprint.crc32 || extractCrc32(adjacent.videoFilePath)) || undefined;
        edition = lexical.edition;
        if (lexical.isExtra) {
            isExtra = true;
            extraType = lexical.extraType || extraType;
        }
        probedData = probed;
        if (probed) {
            if (probed.videoQuality)
                probedQuality = probed.videoQuality;
            if (probed.videoCodec)
                probedCodec = probed.videoCodec;
            if (chapters.length === 0 && probed.chapters.length > 0)
                chapters = probed.chapters;
            if (!durationSeconds && probed.durationSeconds)
                durationSeconds = probed.durationSeconds;
        }
    }
    // Héritage sécurisé du parentId sans pollution SHOW -> MOVIE
    let effectiveParentId = parentId;
    if (!effectiveParentId && existing?.parentId) {
        const currentParent = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eOp }) => eOp(t.id, existing.parentId),
            columns: { id: true, nodeType: true },
        });
        if (currentParent && (effectiveType !== 'MOVIE' || currentParent.nodeType === 'COLLECTION')) {
            effectiveParentId = currentParent.id;
        }
    }
    let nodeId;
    const canonicalTitle = effectiveType === 'SHOW'
        ? extractCanonicalShowTitle(parsed.title || path.basename(path.dirname(nfoPath)))
        : sanitizeReleaseTags(parsed.title);
    const finalSlug = `${generateSlug(canonicalTitle)}-${effYear || 'media'}`;
    const payload = {
        parentId: effectiveParentId ? String(effectiveParentId) : undefined,
        nodeType: effectiveType,
        state: 'READY',
        title: canonicalTitle,
        originalTitle: parsed.originalTitle ? sanitizeReleaseTags(parsed.originalTitle) : undefined,
        sortTitle: effectiveType === 'SHOW' ? canonicalTitle : sanitizeReleaseTags(sortTitle),
        tagline: parsed.tagline,
        overview: parsed.plot || parsed.outline,
        orderIndex,
        absoluteOrderIndex,
        releaseYear: effYear,
        premieredDate,
        runtimeSeconds: durationSeconds,
        communityRating: parsed.rating,
        confidenceScore: 1.0,
        oshash,
        crc32,
        edition,
        isExtra,
        extraType,
        chaptersJson: chapters,
        nfoSha256: sha256,
        videoFilePath: adjacent.videoFilePath,
        posterPath: adjacent.posterPath || parsed.customArt?.poster,
        fanartPath: adjacent.fanartPath || parsed.customArt?.fanart,
        clearlogoPath: adjacent.clearlogoPath || parsed.customArt?.clearlogo,
        thumbPath: adjacent.thumbPath || parsed.customArt?.thumb,
        nfoFilePath: nfoPath,
        updatedAt: new Date(),
    };
    if (existing) {
        nodeId = existing.id;
        await db.update(mediaNodes).set(payload).where(eq(mediaNodes.id, nodeId));
    }
    else {
        const [inserted] = await db
            .insert(mediaNodes)
            .values({
            slug: `${finalSlug}-${Date.now().toString().slice(-4)}`,
            ...payload,
        })
            .returning();
        nodeId = inserted.id;
    }
    // Adoption sécurisée des enfants orphelins sous le même répertoire avec slash terminal
    if (parsed.type === 'SHOW') {
        const showDir = path.dirname(nfoPath);
        await db
            .update(mediaNodes)
            .set({ parentId: nodeId })
            .where(and(isNull(mediaNodes.parentId), ne(mediaNodes.id, nodeId), or(like(mediaNodes.nfoFilePath, `${showDir}/%`), like(mediaNodes.videoFilePath, `${showDir}/%`))));
    }
    // Extraction et liaison des métadonnées vers le schéma EAV
    const eavPromises = [];
    for (const genre of (parsed.genres || [])) {
        eavPromises.push(linkTagToNode(nodeId, 'genre', genre));
    }
    for (const tag of (parsed.tags || [])) {
        eavPromises.push(linkTagToNode(nodeId, 'subject', tag));
    }
    for (const studio of (parsed.studios || [])) {
        eavPromises.push(linkTagToNode(nodeId, 'studio', studio));
    }
    for (const country of (parsed.countries || [])) {
        eavPromises.push(linkTagToNode(nodeId, 'country', country));
    }
    const directorsList = [...(parsed.directors || [])];
    if (directorsList.length === 0 && /tarantino/i.test(filePathToCheck)) {
        directorsList.push('Quentin Tarantino');
    }
    for (const dir of directorsList) {
        eavPromises.push(linkTagToNode(nodeId, 'director', dir));
    }
    for (const writer of (parsed.writers || [])) {
        eavPromises.push(linkTagToNode(nodeId, 'writer', writer));
    }
    for (const actor of (parsed.actors || [])) {
        eavPromises.push(linkTagToNode(nodeId, 'actor', actor.name, actor.role, actor.thumb ? { thumbUrl: actor.thumb } : undefined));
    }
    if (parsed.certification) {
        eavPromises.push(linkTagToNode(nodeId, 'certification', parsed.certification));
    }
    if (probedCodec) {
        eavPromises.push(linkTagToNode(nodeId, 'video_codec', probedCodec));
    }
    if (probedQuality) {
        eavPromises.push(linkTagToNode(nodeId, 'video_quality', probedQuality));
    }
    if (edition) {
        eavPromises.push(linkTagToNode(nodeId, 'edition', edition));
    }
    if (isExtra && extraType) {
        eavPromises.push(linkTagToNode(nodeId, 'extra', extraType));
    }
    if (folderArcTitle) {
        eavPromises.push(linkTagToNode(nodeId, 'arc', folderArcTitle));
    }
    // Inspection profonde des flux vidéo/audio internes
    if (adjacent.videoFilePath && probedData) {
        for (const a of (probedData.audioTracks || [])) {
            if (a.codec)
                eavPromises.push(linkTagToNode(nodeId, 'audio_codec', a.codec));
            if (a.channels)
                eavPromises.push(linkTagToNode(nodeId, 'audio_channels', `${a.channels}ch`));
            if (a.language)
                eavPromises.push(linkTagToNode(nodeId, 'audio_language', a.language));
        }
        for (const s of (probedData.subtitleTracks || [])) {
            if (s.codec)
                eavPromises.push(linkTagToNode(nodeId, 'subtitle_codec', s.codec));
            if (s.language)
                eavPromises.push(linkTagToNode(nodeId, 'subtitle_language', s.language));
        }
        if (!parsed.plot && !parsed.outline) {
            try {
                const subNlp = await analyzeSubtitlesNlp(adjacent.videoFilePath);
                if (subNlp.detectedDisambiguation) {
                    for (const entity of subNlp.detectedDisambiguation.matchedEntities) {
                        eavPromises.push(linkTagToNode(nodeId, 'subject', entity));
                    }
                }
            }
            catch { }
        }
    }
    for (const [key, val] of Object.entries(parsed.customFields)) {
        if (val === undefined || val === null || val === '')
            continue;
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        eavPromises.push(linkTagToNode(nodeId, `custom_${key}`, strVal));
    }
    await Promise.all(eavPromises);
    return nodeId;
}
export async function ingestMediaFile(videoPath) {
    let existing = await db.query.mediaNodes.findFirst({
        where: (t, { eq: eqOp }) => eqOp(t.videoFilePath, videoPath),
    });
    if (!existing) {
        const baseName = path.basename(videoPath);
        const candidates = await db.query.mediaNodes.findMany({
            where: (t, { like: lOp }) => lOp(t.videoFilePath, `%/${baseName}`),
        });
        for (const c of candidates) {
            if (c.videoFilePath && c.videoFilePath !== videoPath && !fs.existsSync(c.videoFilePath)) {
                console.log(`🔁 [Ingester] Fichier déplacé réconcilié pour ${baseName}: ${c.videoFilePath} -> ${videoPath}`);
                existing = c;
                break;
            }
        }
    }
    if (existing && existing.nfoFilePath && existing.videoFilePath === videoPath) {
        return existing.id;
    }
    const meta = await identifyVideoFile(videoPath);
    const slug = `${generateSlug(meta.title)}-${meta.releaseYear || 'video'}`;
    const sortTitle = meta.title;
    let parentId = null;
    const seriesCtx = await resolveSeriesRoot(videoPath);
    let isExtra = meta.isExtra;
    let extraType = meta.extraType;
    let nodeType = meta.nodeType;
    let arcTitle;
    let orderIndex = 0;
    let absoluteOrderIndex = null;
    const isKai = isKaiOrPaceMedia(videoPath);
    let kaiInfo = isKai ? parseKaiEpisodeInfo(videoPath) : null;
    if (kaiInfo) {
        nodeType = 'EPISODE';
        arcTitle = kaiInfo.arcName;
        orderIndex = kaiInfo.orderIndex;
        absoluteOrderIndex = kaiInfo.episode;
        meta.title = kaiInfo.title;
        const showTitleToFind = kaiInfo.showTitle;
        const showNode = await db.query.mediaNodes.findFirst({
            where: (t, { and: aOp, eq: eOp, ilike: iOp }) => aOp(eOp(t.nodeType, 'SHOW'), iOp(t.title, showTitleToFind)),
        });
        if (showNode) {
            parentId = showNode.id;
        }
        else {
            const showSlug = `${generateSlug(showTitleToFind)}-show`;
            const [newShow] = await db
                .insert(mediaNodes)
                .values({
                nodeType: 'SHOW',
                title: showTitleToFind,
                sortTitle: showTitleToFind,
                slug: `${showSlug}-${Date.now().toString().slice(-4)}`,
                state: 'READY',
                releaseYear: 1999,
                overview: 'Version condensée fidèle au manga sans les scènes de remplissage.',
            })
                .returning();
            parentId = newShow.id;
        }
    }
    else {
        if (isExtraMediaFile(videoPath)) {
            isExtra = true;
            nodeType = 'EXTRA';
            const extraGrouping = analyzeFolderGrouping(videoPath, path.dirname(videoPath));
            extraType = extraGrouping.extraType || extraType || 'featurette';
        }
        if (seriesCtx) {
            const grouping = analyzeFolderGrouping(videoPath, seriesCtx.showDir);
            if (grouping.isExtra) {
                isExtra = true;
                extraType = grouping.extraType || extraType;
            }
            if (grouping.isMovie && !meta.episodeNumber && !meta.seasonNumber) {
                nodeType = 'MOVIE';
            }
            if (grouping.groupTitle) {
                arcTitle = grouping.groupTitle;
            }
        }
        if (nodeType === 'EPISODE') {
            parentId = await resolveParentShowNodeId(videoPath);
        }
        else if (nodeType === 'MOVIE') {
            const folderSagaName = detectSagaNameFromFolder(videoPath);
            if (folderSagaName) {
                const sagaNode = await findOrCreateCollectionNode(folderSagaName);
                if (sagaNode)
                    parentId = sagaNode.id;
            }
        }
        if (nodeType === 'MOVIE') {
            // Les films d'une saga doivent être ordonnés chronologiquement par année.
            orderIndex = meta.releaseYear || 0;
            absoluteOrderIndex = meta.releaseYear || null;
        }
        else if (meta.absoluteEpisodeNumber != null && meta.absoluteEpisodeNumber > 0) {
            orderIndex = meta.absoluteEpisodeNumber;
            absoluteOrderIndex = meta.absoluteEpisodeNumber;
        }
        else if (meta.episodeNumber != null && meta.episodeNumber > 0) {
            orderIndex = (meta.seasonNumber && meta.seasonNumber > 1)
                ? meta.seasonNumber * 1000 + meta.episodeNumber
                : meta.episodeNumber;
            absoluteOrderIndex = meta.episodeNumber;
        }
        else if (meta.seasonNumber != null && meta.seasonNumber > 0) {
            orderIndex = meta.seasonNumber;
        }
    }
    // Héritage sécurisé du parentId sans pollution SHOW -> MOVIE
    let effectiveParentId = parentId;
    if (!effectiveParentId && existing?.parentId) {
        const currentParent = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eOp }) => eOp(t.id, existing.parentId),
            columns: { id: true, nodeType: true },
        });
        if (currentParent && (nodeType !== 'MOVIE' || currentParent.nodeType === 'COLLECTION')) {
            effectiveParentId = currentParent.id;
        }
    }
    const canonicalTitle = nodeType === 'SHOW'
        ? extractCanonicalShowTitle(meta.title)
        : (sanitizeReleaseTags(meta.title) || meta.title);
    const payload = {
        parentId: effectiveParentId ? String(effectiveParentId) : undefined,
        nodeType,
        title: canonicalTitle,
        originalTitle: meta.originalTitle,
        sortTitle: nodeType === 'SHOW' ? canonicalTitle : (sanitizeReleaseTags(sortTitle) || canonicalTitle),
        orderIndex,
        absoluteOrderIndex,
        releaseYear: meta.releaseYear,
        runtimeSeconds: meta.durationSeconds,
        confidenceScore: meta.confidenceScore,
        oshash: meta.oshash,
        crc32: meta.crc32,
        edition: meta.edition,
        isExtra,
        extraType,
        chaptersJson: meta.chapters,
        videoFilePath: videoPath,
        state: (meta.confidenceScore >= 0.9 ? 'READY' : 'DISCOVERED'),
        updatedAt: new Date(),
    };
    let nodeId;
    if (existing) {
        nodeId = existing.id;
        await db.update(mediaNodes).set(payload).where(eq(mediaNodes.id, nodeId));
    }
    else {
        const [inserted] = await db
            .insert(mediaNodes)
            .values({
            slug: `${slug}-${Date.now().toString().slice(-4)}`,
            ...payload,
        })
            .returning();
        nodeId = inserted.id;
    }
    return nodeId;
}
export const ingestStandaloneVideoFile = ingestMediaFile;
