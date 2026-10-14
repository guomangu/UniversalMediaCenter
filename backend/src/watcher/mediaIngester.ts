import path from 'node:path';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, ne, isNull, or, like } from 'drizzle-orm';
import { generateSlug } from './slugify.js';
import { linkTagToNode } from './tagExtractor.js';
import { calculateOSHash, extractCrc32 } from './pipeline/binaryFingerprint.js';
import { probeMediaFile } from './pipeline/ffprobeProbe.js';
import { parseLexicalFilename } from './pipeline/lexicalParser.js';
import { identifyVideoFile } from './pipeline/universalScanner.js';
import type { } from './pipeline/universalScanner.js';
import type { UnifiedMediaMetadata } from './pipeline/universalScanner.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';
import { resolveSeriesRoot, resolveParentShowNodeId } from './hierarchyResolver.js';
import { analyzeFolderGrouping } from './folderGrouper.js';
import type { ParsedNfo } from './types.js';

export async function ingestMediaNode(
  nfoPath: string,
  parsed: ParsedNfo,
  sha256: string
): Promise<string> {
  const adjacent = await detectAdjacentFiles(nfoPath);
  const slug = `${generateSlug(parsed.title)}-${parsed.year || 'media'}`;
  const sortTitle = parsed.sortTitle || parsed.title;

  let parentId: string | null = null;
  let isExtra = false;
  let extraType: string | undefined;
  let effectiveType = parsed.type;
  let folderArcTitle = parsed.folderTitle;

  if (parsed.type !== 'SHOW' && parsed.type !== 'COLLECTION') {
    parentId = await resolveParentShowNodeId(nfoPath);

    if (!parentId && parsed.showTitle) {
      const showByTitle = await db.query.mediaNodes.findFirst({
        where: (t, { and: aOp, eq: eOp, or: oOp }) =>
          aOp(
            eOp(t.nodeType, 'SHOW'),
            oOp(eOp(t.title, parsed.showTitle!), eOp(t.sortTitle, parsed.showTitle!))
          ),
      });
      if (showByTitle) parentId = showByTitle.id;
    }

    const seriesCtx = await resolveSeriesRoot(nfoPath);
    if (seriesCtx) {
      const grouping = analyzeFolderGrouping(nfoPath, seriesCtx.showDir);
      if (grouping.isExtra) {
        isExtra = true;
        extraType = grouping.extraType;
      }
      if (grouping.isMovie) {
        effectiveType = 'MOVIE';
      }
      if (grouping.groupTitle && !folderArcTitle) {
        folderArcTitle = grouping.groupTitle;
      }
    }
  }

  // Déduplication stricte par chemin NFO
  const existing = await db.query.mediaNodes.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.nfoFilePath, nfoPath),
  });

  // Calcul d'index d'ordre unifié et sans collision entre saisons
  let orderIndex = 0;
  let absoluteOrderIndex: number | null = null;

  if (effectiveType === 'MOVIE') {
    orderIndex = parsed.episodeNumber ?? 0;
    absoluteOrderIndex = null;
  } else if (parsed.absoluteEpisodeNumber != null && parsed.absoluteEpisodeNumber > 0) {
    orderIndex = parsed.absoluteEpisodeNumber;
    absoluteOrderIndex = parsed.absoluteEpisodeNumber;
  } else if (parsed.episodeNumber != null && parsed.episodeNumber > 0) {
    if (parsed.seasonNumber && parsed.seasonNumber > 1) {
      orderIndex = parsed.seasonNumber * 1000 + parsed.episodeNumber;
      absoluteOrderIndex = parsed.seasonNumber * 1000 + parsed.episodeNumber;
    } else {
      orderIndex = parsed.episodeNumber;
      absoluteOrderIndex = parsed.episodeNumber;
    }
  } else if (parsed.seasonNumber != null && parsed.seasonNumber > 0) {
    orderIndex = parsed.seasonNumber;
  }

  let durationSeconds: number | undefined;
  if (parsed.streamDetails?.durationSeconds) {
    durationSeconds = parsed.streamDetails.durationSeconds;
  } else if (parsed.runtime) {
    durationSeconds = parsed.runtime * 60;
  }

  let premieredDate: Date | undefined;
  if (parsed.premiered) {
    const d = new Date(parsed.premiered);
    if (!isNaN(d.getTime())) premieredDate = d;
  }

  let oshash: string | undefined;
  let crc32: string | undefined;
  let edition: string | undefined;
  let chapters = parsed.chapters || [];

  if (adjacent.videoFilePath) {
    oshash = (await calculateOSHash(adjacent.videoFilePath)) || undefined;
    crc32 = extractCrc32(adjacent.videoFilePath) || undefined;
    const lexical = parseLexicalFilename(adjacent.videoFilePath);
    edition = lexical.edition;
    if (lexical.isExtra) {
      isExtra = true;
      extraType = lexical.extraType || extraType;
    }

    if (chapters.length === 0 || !durationSeconds) {
      const probed = await probeMediaFile(adjacent.videoFilePath);
      if (probed) {
        if (chapters.length === 0 && probed.chapters.length > 0) chapters = probed.chapters;
        if (!durationSeconds && probed.durationSeconds) durationSeconds = probed.durationSeconds;
      }
    }
  }

  let nodeId: string;
  const payload = {
    parentId: parentId || (existing?.parentId ?? undefined),
    nodeType: effectiveType,
    state: 'READY' as const,
    title: parsed.title,
    originalTitle: parsed.originalTitle,
    sortTitle,
    tagline: parsed.tagline,
    overview: parsed.plot || parsed.plot || parsed.outline,
    orderIndex,
    absoluteOrderIndex,
    releaseYear: parsed.year,
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
  } else {
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
      .where(
        and(
          isNull(mediaNodes.parentId),
          ne(mediaNodes.id, nodeId),
          or(
            like(mediaNodes.nfoFilePath, `${showDir}/%`),
            like(mediaNodes.videoFilePath, `${showDir}/%`)
          )
        )
      );
  }

  // Tags et EAV
  for (const g of parsed.genres) await linkTagToNode(nodeId, 'genre', g);
  for (const s of parsed.tags) await linkTagToNode(nodeId, 'subject', s);
  for (const st of parsed.studios) await linkTagToNode(nodeId, 'studio', st);
  for (const c of parsed.countries) await linkTagToNode(nodeId, 'country', c);
  if (parsed.certification) await linkTagToNode(nodeId, 'certification', parsed.certification);
  if (folderArcTitle) await linkTagToNode(nodeId, 'arc', folderArcTitle);
  if (edition) await linkTagToNode(nodeId, 'edition', edition);
  if (isExtra) await linkTagToNode(nodeId, 'extra', extraType || 'bonus');

  for (const d of parsed.directors) await linkTagToNode(nodeId, 'director', d);
  for (const w of parsed.writers) await linkTagToNode(nodeId, 'writer', w);
  if (parsed.producers) {
    for (const pr of parsed.producers) await linkTagToNode(nodeId, 'producer', pr);
  }
  if (parsed.composers) {
    for (const m of parsed.composers) await linkTagToNode(nodeId, 'composer', m);
  }
  for (const a of parsed.actors) {
    await linkTagToNode(nodeId, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {});
  }

  const sd = parsed.streamDetails;
  if (sd?.videoQuality) await linkTagToNode(nodeId, 'video_quality', sd.videoQuality);
  if (sd?.videoCodec) await linkTagToNode(nodeId, 'video_codec', sd.videoCodec.toUpperCase());
  if (sd?.aspectRatio) await linkTagToNode(nodeId, 'aspect_ratio', sd.aspectRatio);

  if (sd?.audioTracks) {
    for (const audio of sd.audioTracks) {
      if (audio.language) await linkTagToNode(nodeId, 'audio_language', audio.language.toUpperCase());
      if (audio.codec) await linkTagToNode(nodeId, 'audio_codec', audio.codec.toUpperCase());
      if (audio.channels) {
        const ch = audio.channels >= 6 ? (audio.channels === 8 ? '7.1' : '5.1') : `${audio.channels}.0`;
        await linkTagToNode(nodeId, 'audio_channels', ch);
      }
    }
  }

  if (sd?.subtitleTracks) {
    for (const sub of sd.subtitleTracks) {
      if (sub.language) await linkTagToNode(nodeId, 'subtitle_language', sub.language.toUpperCase());
      if (sub.codec) await linkTagToNode(nodeId, 'subtitle_codec', sub.codec.toUpperCase());
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
export async function ingestStandaloneVideoFile(videoPath: string): Promise<string> {
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

  const meta: UnifiedMediaMetadata = await identifyVideoFile(videoPath);
  const slug = `${generateSlug(meta.title)}-${meta.releaseYear || 'video'}`;
  const sortTitle = meta.title;

  let parentId = await resolveParentShowNodeId(videoPath);
  const seriesCtx = await resolveSeriesRoot(videoPath);

  // Rattachement automatique au SHOW parent déterministe
  if (!parentId && seriesCtx) {
    const showByTitle = await db.query.mediaNodes.findFirst({
      where: (t, { and: aOp, eq: eOp, or: oOp }) =>
        aOp(
          eOp(t.nodeType, 'SHOW'),
          oOp(eOp(t.title, seriesCtx.showTitleCandidate), eOp(t.sortTitle, seriesCtx.showTitleCandidate))
        ),
    });

    if (showByTitle) {
      parentId = showByTitle.id;
    } else {
      const showSlug = `${generateSlug(seriesCtx.showTitleCandidate)}-show`;
      const [newShow] = await db
        .insert(mediaNodes)
        .values({
          nodeType: 'SHOW',
          title: seriesCtx.showTitleCandidate,
          sortTitle: seriesCtx.showTitleCandidate,
          slug: `${showSlug}-${Date.now().toString().slice(-4)}`,
          state: 'READY',
          confidenceScore: 0.95,
          updatedAt: new Date(),
        })
        .returning();
      parentId = newShow.id;
    }
  }

  let isExtra = meta.isExtra;
  let extraType = meta.extraType;
  let nodeType = meta.nodeType;
  let arcTitle: string | undefined;

  if (seriesCtx) {
    const grouping = analyzeFolderGrouping(videoPath, seriesCtx.showDir);
    if (grouping.isExtra) {
      isExtra = true;
      extraType = grouping.extraType || extraType;
    }
    if (grouping.isMovie) {
      nodeType = 'MOVIE';
    }
    if (grouping.groupTitle) {
      arcTitle = grouping.groupTitle;
    }
  }

  let orderIndex = 0;
  let absoluteOrderIndex: number | null = null;
  if (meta.absoluteEpisodeNumber != null && meta.absoluteEpisodeNumber > 0) {
    orderIndex = meta.absoluteEpisodeNumber;
    absoluteOrderIndex = meta.absoluteEpisodeNumber;
  } else if (meta.episodeNumber != null && meta.episodeNumber > 0) {
    orderIndex = (meta.seasonNumber && meta.seasonNumber > 1)
      ? meta.seasonNumber * 1000 + meta.episodeNumber
      : meta.episodeNumber;
    absoluteOrderIndex = meta.episodeNumber;
  } else if (meta.seasonNumber != null && meta.seasonNumber > 0) {
    orderIndex = meta.seasonNumber;
  }

  const payload = {
    parentId: parentId || (existing?.parentId ?? undefined),
    nodeType,
    title: meta.title,
    originalTitle: meta.originalTitle,
    sortTitle,
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
    state: (meta.confidenceScore >= 0.9 ? 'READY' : 'DISCOVERED') as any,
    updatedAt: new Date(),
  };

  let nodeId: string;
  if (existing) {
    nodeId = existing.id;
    await db.update(mediaNodes).set(payload).where(eq(mediaNodes.id, nodeId));
  } else {
    const [inserted] = await db
      .insert(mediaNodes)
      .values({
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        ...payload,
      })
      .returning();
    nodeId = inserted.id;
  }

  if (meta.edition) await linkTagToNode(nodeId, 'edition', meta.edition);
  if (isExtra) await linkTagToNode(nodeId, 'extra', extraType || 'bonus');
  if (arcTitle) await linkTagToNode(nodeId, 'arc', arcTitle);
  if (meta.videoQuality) await linkTagToNode(nodeId, 'video_quality', meta.videoQuality);
  if (meta.videoCodec) await linkTagToNode(nodeId, 'video_codec', meta.videoCodec.toUpperCase());

  for (const audio of meta.audioTracks) {
    if (audio.language) await linkTagToNode(nodeId, 'audio_language', audio.language.toUpperCase());
    if (audio.codec) await linkTagToNode(nodeId, 'audio_codec', audio.codec.toUpperCase());
    if (audio.channels) {
      const ch = audio.channels >= 6 ? (audio.channels === 8 ? '7.1' : '5.1') : `${audio.channels}.0`;
      await linkTagToNode(nodeId, 'audio_channels', ch);
    }
  }

  for (const sub of meta.subtitleTracks) {
    if (sub.language) await linkTagToNode(nodeId, 'subtitle_language', sub.language.toUpperCase());
    if (sub.codec) await linkTagToNode(nodeId, 'subtitle_codec', sub.codec.toUpperCase());
    if (sub.forced) await linkTagToNode(nodeId, 'subtitle_forced', 'Forcé');
    if (sub.sdh) await linkTagToNode(nodeId, 'subtitle_sdh', 'SDH');
  }

  if (meta.confidenceScore < 0.90) {
    await linkTagToNode(nodeId, 'status', 'À vérifier');
  }

  const searchVector = [
    meta.title,
    meta.originalTitle || '',
    meta.edition || '',
    arcTitle || '',
    meta.videoQuality || '',
    meta.videoCodec || '',
    ...meta.audioTracks.map((a) => a.language || ''),
    ...meta.subtitleTracks.map((s) => s.language || ''),
  ]
    .filter(Boolean)
    .join(' ');

  await db.update(mediaNodes).set({ searchVectorText: searchVector }).where(eq(mediaNodes.id, nodeId));

  return nodeId;
}
