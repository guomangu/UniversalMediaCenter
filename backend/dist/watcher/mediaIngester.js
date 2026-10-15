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
export async function ingestMediaNode(nfoPath, parsed, sha256) {
    const adjacent = await detectAdjacentFiles(nfoPath);
    const slug = `${generateSlug(parsed.title)}-${parsed.year || 'media'}`;
    const sortTitle = parsed.sortTitle || parsed.title;
    let parentId = null;
    let isExtra = false;
    let extraType;
    let effectiveType = parsed.type;
    let folderArcTitle = parsed.folderTitle;
    if (parsed.type !== 'SHOW' && parsed.type !== 'COLLECTION') {
        parentId = await resolveParentShowNodeId(nfoPath);
        if (!parentId && parsed.showTitle) {
            const canonicalShow = extractCanonicalShowTitle(parsed.showTitle);
            const showByTitle = await db.query.mediaNodes.findFirst({
                where: (t, { and: aOp, eq: eOp, or: oOp, ilike: iOp }) => aOp(eOp(t.nodeType, 'SHOW'), oOp(iOp(t.title, canonicalShow), iOp(t.sortTitle, canonicalShow), eOp(t.title, parsed.showTitle), eOp(t.sortTitle, parsed.showTitle))),
            });
            if (showByTitle)
                parentId = showByTitle.id;
        }
        const filePathToCheck = adjacent.videoFilePath || nfoPath;
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
            if (grouping.isMovie && !parsed.episodeNumber && effectiveType !== 'EPISODE') {
                effectiveType = 'MOVIE';
            }
            if (grouping.groupTitle && !folderArcTitle) {
                folderArcTitle = grouping.groupTitle;
            }
        }
        if (effectiveType === 'MOVIE' && !parentId) {
            const folderSagaName = detectSagaNameFromFolder(nfoPath || adjacent.videoFilePath || '');
            if (folderSagaName) {
                const sagaNode = await findOrCreateCollectionNode(folderSagaName);
                if (sagaNode)
                    parentId = sagaNode.id;
            }
        }
    }
    // Déduplication stricte par chemin NFO
    const existing = await db.query.mediaNodes.findFirst({
        where: (t, { eq: eqOp }) => eqOp(t.nfoFilePath, nfoPath),
    });
    // Calcul d'index d'ordre unifié et sans collision entre saisons
    let orderIndex = 0;
    let absoluteOrderIndex = null;
    // 1. Parsing heuristique GuessIt avec validation stricte Kyoo
    const guess = await parsePathWithGuessit(adjacent.videoFilePath || nfoPath);
    if (guess.type === 'movie' && effectiveType !== 'COLLECTION' && effectiveType !== 'EPISODE' && !parsed.episodeNumber) {
        effectiveType = 'MOVIE';
    }
    else if (guess.type === 'episode' && effectiveType !== 'SHOW' && effectiveType !== 'COLLECTION') {
        effectiveType = 'EPISODE';
    }
    if (effectiveType === 'EPISODE' && !parentId) {
        parentId = await resolveParentShowNodeId(adjacent.videoFilePath || nfoPath);
    }
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
    let nodeId;
    const canonicalTitle = effectiveType === 'SHOW'
        ? extractCanonicalShowTitle(parsed.title || path.basename(path.dirname(nfoPath)))
        : sanitizeReleaseTags(parsed.title);
    const payload = {
        parentId: (parentId || existing?.parentId) ? String(parentId || existing?.parentId) : undefined,
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
        posterPath: adjacent.posterPath,
        fanartPath: adjacent.fanartPath,
        clearlogoPath: adjacent.clearlogoPath,
        thumbPath: adjacent.thumbPath,
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
            slug: `${slug}-${Date.now().toString().slice(-4)}`,
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
    // Tags et EAV
    for (const g of parsed.genres)
        await linkTagToNode(nodeId, 'genre', g);
    for (const s of parsed.tags)
        await linkTagToNode(nodeId, 'subject', s);
    for (const st of parsed.studios)
        await linkTagToNode(nodeId, 'studio', st);
    for (const c of parsed.countries)
        await linkTagToNode(nodeId, 'country', c);
    if (parsed.certification)
        await linkTagToNode(nodeId, 'certification', parsed.certification);
    if (folderArcTitle)
        await linkTagToNode(nodeId, 'arc', folderArcTitle);
    if (edition)
        await linkTagToNode(nodeId, 'edition', edition);
    if (isExtra)
        await linkTagToNode(nodeId, 'extra', extraType || 'bonus');
    for (const d of parsed.directors)
        await linkTagToNode(nodeId, 'director', d);
    for (const w of parsed.writers)
        await linkTagToNode(nodeId, 'writer', w);
    if (parsed.producers) {
        for (const pr of parsed.producers)
            await linkTagToNode(nodeId, 'producer', pr);
    }
    if (parsed.composers) {
        for (const m of parsed.composers)
            await linkTagToNode(nodeId, 'composer', m);
    }
    for (const a of parsed.actors) {
        await linkTagToNode(nodeId, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {});
    }
    const sd = parsed.streamDetails;
    const effQuality = probedQuality || sd?.videoQuality;
    if (effQuality)
        await linkTagToNode(nodeId, 'video_quality', effQuality);
    if (sd?.videoCodec)
        await linkTagToNode(nodeId, 'video_codec', sd.videoCodec.toUpperCase());
    if (sd?.aspectRatio)
        await linkTagToNode(nodeId, 'aspect_ratio', sd.aspectRatio);
    if (sd?.audioTracks) {
        for (const audio of sd.audioTracks) {
            if (audio.language)
                await linkTagToNode(nodeId, 'audio_language', audio.language.toUpperCase());
            if (audio.codec)
                await linkTagToNode(nodeId, 'audio_codec', audio.codec.toUpperCase());
            if (audio.channels) {
                const ch = audio.channels >= 6 ? (audio.channels === 8 ? '7.1' : '5.1') : `${audio.channels}.0`;
                await linkTagToNode(nodeId, 'audio_channels', ch);
            }
        }
    }
    if (sd?.subtitleTracks) {
        for (const sub of sd.subtitleTracks) {
            if (sub.language)
                await linkTagToNode(nodeId, 'subtitle_language', sub.language.toUpperCase());
            if (sub.codec)
                await linkTagToNode(nodeId, 'subtitle_codec', sub.codec.toUpperCase());
        }
    }
    for (const [key, val] of Object.entries(parsed.customFields || {})) {
        await linkTagToNode(nodeId, `custom_${key.toLowerCase()}`, val);
    }
    const searchComponents = [
        parsed.title,
        parsed.originalTitle || '',
        folderArcTitle || '',
        edition || '',
        ...parsed.genres,
        ...parsed.tags,
        ...parsed.directors,
        ...parsed.writers,
        ...parsed.actors.map((a) => a.name),
        sd?.videoQuality || '',
        sd?.videoCodec || '',
        ...(sd?.audioTracks || []).map((a) => a.language || ''),
        ...(sd?.subtitleTracks || []).map((s) => s.language || ''),
    ];
    await db
        .update(mediaNodes)
        .set({ searchVectorText: searchComponents.filter(Boolean).join(' ') })
        .where(eq(mediaNodes.id, nodeId));
    return nodeId;
}
/**
 * Ingestion autonome de fichier vidéo sans NFO via le pipeline Waterfall Kyoo++
 */
export async function ingestStandaloneVideoFile(videoPath) {
    // Ignorer absolument les artefacts de trickplay
    if (videoPath.includes('/.trickplay/') || videoPath.endsWith('.bif')) {
        return '';
    }
    // 1. Si le fichier vidéo est déjà rattaché à un noeud existant avec NFO, ne pas créer de doublon
    const existing = await db.query.mediaNodes.findFirst({
        where: (t, { eq: eqOp }) => eqOp(t.videoFilePath, videoPath),
    });
    if (existing && existing.nfoFilePath) {
        return existing.id;
    }
    const meta = await identifyVideoFile(videoPath);
    const slug = `${generateSlug(meta.title)}-${meta.releaseYear || 'video'}`;
    const sortTitle = meta.title;
    let parentId = await resolveParentShowNodeId(videoPath);
    const seriesCtx = await resolveSeriesRoot(videoPath);
    let isExtra = meta.isExtra;
    let extraType = meta.extraType;
    let nodeType = meta.nodeType;
    let arcTitle;
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
    if (nodeType === 'MOVIE' && !parentId) {
        const folderSagaName = detectSagaNameFromFolder(videoPath);
        if (folderSagaName) {
            const sagaNode = await findOrCreateCollectionNode(folderSagaName);
            if (sagaNode)
                parentId = sagaNode.id;
        }
    }
    let orderIndex = 0;
    let absoluteOrderIndex = null;
    if (meta.absoluteEpisodeNumber != null && meta.absoluteEpisodeNumber > 0) {
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
    const canonicalTitle = nodeType === 'SHOW'
        ? extractCanonicalShowTitle(meta.title)
        : meta.title;
    const payload = {
        parentId: (parentId || existing?.parentId) ? String(parentId || existing?.parentId) : undefined,
        nodeType,
        title: canonicalTitle,
        originalTitle: meta.originalTitle,
        sortTitle: nodeType === 'SHOW' ? canonicalTitle : sortTitle,
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
