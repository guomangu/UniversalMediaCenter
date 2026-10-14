import { calculateOSHash, extractCrc32, extractExplicitIds } from './binaryFingerprint.js';
import { probeMediaFile } from './ffprobeProbe.js';
import { parseLexicalFilename } from './lexicalParser.js';
import { inferSiblingContext } from './siblingContext.js';
import { detectSidecarSubtitles } from './sidecarSubtitles.js';
import { computeConfidenceScore } from './bayesianMatcher.js';
import { readSidecarCache, writeSidecarCache } from './sidecarCache.js';
import type { Chapter } from '../../db/schema/nodes.js';

export interface UnifiedMediaMetadata {
  videoFilePath: string;
  title: string;
  showTitle?: string;
  originalTitle?: string;
  nodeType: 'MOVIE' | 'SHOW' | 'EPISODE';
  releaseYear?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteEpisodeNumber?: number;
  parentId?: string;
  durationSeconds?: number;
  confidenceScore: number;
  edition?: string;
  isExtra: boolean;
  extraType?: string;
  oshash?: string;
  crc32?: string;
  chapters: Chapter[];
  audioTracks: Array<{ language?: string; codec?: string; channels?: number }>;
  subtitleTracks: Array<{ language?: string; codec?: string; forced?: boolean; sdh?: boolean }>;
  videoCodec?: string;
  videoQuality?: string;
}

/**
 * Exécute l'entonnoir d'identification multimodal en cascade (Waterfall Pipeline)
 */
export async function identifyVideoFile(filePath: string): Promise<UnifiedMediaMetadata> {
  const cached = await readSidecarCache(filePath);
  const oshash = cached?.oshash || (await calculateOSHash(filePath)) || undefined;
  const crc32 = cached?.crc32 || extractCrc32(filePath) || undefined;
  const explicit = extractExplicitIds(filePath);

  const probed = await probeMediaFile(filePath);
  const lexical = parseLexicalFilename(filePath);
  const sibling = await inferSiblingContext(filePath);
  const sidecarSubs = await detectSidecarSubtitles(filePath);

  const hasHashOrId = Boolean(explicit.tmdbId || explicit.imdbId || explicit.anidbId);
  const confidenceScore =
    cached?.confidenceScore ??
    computeConfidenceScore({
      extractedTitle: lexical.cleanTitle,
      extractedYear: lexical.year,
      actualDurationSeconds: probed?.durationSeconds,
      hasHashOrIdMatch: hasHashOrId,
      siblingContextAvailable: Boolean(sibling.parentShowNodeId),
    });

  const allSubtitles = [
    ...(probed?.subtitleTracks || []),
    ...sidecarSubs.map((s) => ({
      language: s.language,
      codec: s.codec,
      forced: s.forced,
      sdh: s.sdh,
    })),
  ];

  let nodeType: UnifiedMediaMetadata['nodeType'] = 'MOVIE';
  if (lexical.seasonNumber || lexical.episodeNumber || lexical.absoluteEpisodeNumber || sibling.seasonNumber) {
    nodeType = 'EPISODE';
  }

  const showTitle = lexical.showTitle || sibling.parentShowTitle;

  const result: UnifiedMediaMetadata = {
    videoFilePath: filePath,
    title: lexical.cleanTitle,
    showTitle,
    originalTitle: probed?.containerTitle,
    nodeType,
    releaseYear: lexical.year,
    seasonNumber: lexical.seasonNumber || sibling.seasonNumber,
    episodeNumber: lexical.episodeNumber,
    absoluteEpisodeNumber: lexical.absoluteEpisodeNumber,
    parentId: sibling.parentShowNodeId,
    durationSeconds: probed?.durationSeconds || cached?.durationSeconds,
    confidenceScore,
    edition: lexical.edition || cached?.edition,
    isExtra: lexical.isExtra,
    extraType: lexical.extraType,
    oshash,
    crc32,
    chapters: probed?.chapters || [],
    audioTracks: probed?.audioTracks || [],
    subtitleTracks: allSubtitles,
    videoCodec: probed?.videoCodec,
    videoQuality: probed?.videoQuality,
  };

  await writeSidecarCache(filePath, {
    oshash,
    crc32,
    confidenceScore,
    durationSeconds: result.durationSeconds,
    edition: result.edition,
    isExtra: result.isExtra,
    extraType: result.extraType,
    chapters: result.chapters,
  });

  return result;
}
