import { calculateOSHash, extractCrc32, extractExplicitIds } from './binaryFingerprint.js';
import { computeBinaryFootprint } from './binaryHasher.js';
import { inspectContainerMetadata } from './containerInspector.js';
import { analyzeSubtitlesNlp } from './subtitleNlpMatcher.js';
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
  ed2k?: string;
  crc32?: string;
  imdbId?: string;
  tmdbId?: number;
  chapters: Chapter[];
  audioTracks: Array<{ language?: string; codec?: string; channels?: number }>;
  subtitleTracks: Array<{ language?: string; codec?: string; forced?: boolean; sdh?: boolean }>;
  videoCodec?: string;
  videoQuality?: string;
}

/**
 * Exécute l'entonnoir d'identification multimodal en cascade (Waterfall Pipeline) :
 * 1. Empreinte binaire (OpenSubtitles Hash + ED2K AniDB + CRC32)
 * 2. Inspection interne du conteneur (tags MKV/MP4, segment title, IMDb/TMDb injectés, chapitres)
 * 3. Analyse sémantique NLP des sous-titres (NER personnages, désambiguïsation séries US vs UK)
 * 4. Parsing lexical & heuristique
 */
export async function identifyVideoFile(filePath: string): Promise<UnifiedMediaMetadata> {
  const cached = await readSidecarCache(filePath);

  // 1. Empreinte binaire (O(1))
  const binaryFootprint = await computeBinaryFootprint(filePath);
  const oshash = cached?.oshash || binaryFootprint.oshash;
  const ed2k = binaryFootprint.ed2k;
  const crc32 = cached?.crc32 || binaryFootprint.crc32;
  const explicit = extractExplicitIds(filePath);

  // 2. Inspection interne du conteneur & streams
  const [probed, containerMeta] = await Promise.all([
    probeMediaFile(filePath),
    inspectContainerMetadata(filePath),
  ]);

  const lexical = parseLexicalFilename(filePath);
  const sibling = await inferSiblingContext(filePath);
  const sidecarSubs = await detectSidecarSubtitles(filePath);

  // 3. Analyse NLP des sous-titres
  const subtitleNlp = await analyzeSubtitlesNlp(filePath, lexical.cleanTitle);

  // Résolution prioritaire d'identifiants
  const imdbId = containerMeta.imdbId || explicit.imdbId || subtitleNlp.detectedDisambiguation?.imdbId;
  const tmdbId = containerMeta.tmdbId || explicit.tmdbId || subtitleNlp.detectedDisambiguation?.tmdbId;

  const hasHashOrId = Boolean(tmdbId || imdbId || explicit.anidbId || oshash || ed2k);
  const confidenceScore =
    cached?.confidenceScore ??
    computeConfidenceScore({
      extractedTitle: lexical.cleanTitle,
      extractedYear: lexical.year || containerMeta.releaseYear,
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

  // Titre propre avec arbitrage : NLP / Conteneur / Nom lexical
  let finalTitle = lexical.cleanTitle;
  if (subtitleNlp.detectedDisambiguation) {
    finalTitle = subtitleNlp.detectedDisambiguation.canonicalTitle;
  } else if (containerMeta.segmentTitle && (/^\d+$/.test(finalTitle) || finalTitle.length < 3)) {
    finalTitle = containerMeta.segmentTitle;
  } else if (subtitleNlp.detectedTitle && (/^\d+$/.test(finalTitle) || finalTitle.length < 3)) {
    finalTitle = subtitleNlp.detectedTitle;
  }

  const showTitle = lexical.showTitle || sibling.parentShowTitle;

  const result: UnifiedMediaMetadata = {
    videoFilePath: filePath,
    title: finalTitle,
    showTitle,
    originalTitle: probed?.containerTitle || containerMeta.segmentTitle,
    nodeType,
    releaseYear: lexical.year || containerMeta.releaseYear,
    seasonNumber: lexical.seasonNumber || sibling.seasonNumber,
    episodeNumber: lexical.episodeNumber,
    absoluteEpisodeNumber: lexical.absoluteEpisodeNumber,
    parentId: sibling.parentShowNodeId,
    durationSeconds: probed?.durationSeconds || cached?.durationSeconds,
    confidenceScore,
    edition: containerMeta.edition || lexical.edition || cached?.edition,
    isExtra: lexical.isExtra,
    extraType: lexical.extraType,
    oshash,
    ed2k,
    crc32,
    imdbId,
    tmdbId,
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
