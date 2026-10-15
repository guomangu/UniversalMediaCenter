import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sanitizeReleaseTags, extractYearFromText } from '../titleCleaner.js';

const execFileAsync = promisify(execFile);

export interface GuessitResult {
  title: string;
  originalTitle?: string;
  year?: number;
  type: 'movie' | 'episode';
  season?: number;
  episode?: number;
  absoluteEpisode?: number;
  videoQuality?: string;
  videoCodec?: string;
  audioCodec?: string;
  crc32?: string;
  releaseGroup?: string;
}

/**
 * Parsing heuristique via GuessIt avec couche de validation stricte Kyoo.
 * Évite impérativement les faux positifs (ne confond jamais une résolution ou une année avec un épisode).
 */
export async function parsePathWithGuessit(filePath: string): Promise<GuessitResult> {
  const normPath = filePath.replace(/\\/g, '/');
  const filename = normPath.split('/').pop() || '';
  const isFilmsPath = /\/(films|movies|marvel|action|comedy|drame|drama|spectacle)\//i.test(normPath);
  const isSeriesPath = /\/(series|séries|anime|animes|tv|shows)\//i.test(normPath);

  let rawGuess: any = null;

  try {
    const { stdout } = await execFileAsync('guessit', ['-j', normPath], { timeout: 5000 });
    rawGuess = JSON.parse(stdout);
  } catch {
    // Si la commande CLI n'est pas disponible ou time out, fallback regex in-process
  }

  // --- COUCHE DE VALIDATION STRICTE KYOO PAR-DESSUS GUESSIT ---

  // 1. Détection de l'année (ne jamais confondre avec un épisode)
  let year: number | undefined;
  if (rawGuess?.year && typeof rawGuess.year === 'number' && rawGuess.year >= 1890 && rawGuess.year <= 2099) {
    year = rawGuess.year;
  } else {
    year = extractYearFromText(filename) || extractYearFromText(normPath);
  }

  // 2. Détection du type de média
  let mediaType: 'movie' | 'episode' = 'movie';
  if (isFilmsPath && !isSeriesPath) {
    mediaType = 'movie';
  } else if (rawGuess?.type === 'episode' || isSeriesPath) {
    mediaType = 'episode';
  } else if (rawGuess?.type === 'movie') {
    mediaType = 'movie';
  }

  // 3. Titre propre et nettoyé de tout préfixe de piste (ex: "01 Iron Man" -> "Iron Man")
  let titleCandidate = rawGuess?.title ? String(rawGuess.title) : filename.replace(/\.[^.]+$/, '');
  let cleanTitle = sanitizeReleaseTags(titleCandidate);

  // 4. Numéro de Saison & Épisode avec filtrage anti-faux-positifs
  let season: number | undefined;
  let episode: number | undefined;
  let absoluteEpisode: number | undefined;

  if (mediaType === 'episode') {
    let rawEp = rawGuess?.episode;
    if (Array.isArray(rawEp)) rawEp = rawEp[0];
    const epNum = typeof rawEp === 'number' ? rawEp : parseInt(String(rawEp || ''), 10);

    // ANTI-FAUX-POSITIF : Si l'épisode est une année (1990-2099) ou une résolution (480, 576, 720, 1080, 2160)
    const isAbsurdEp =
      !isNaN(epNum) &&
      ((epNum >= 1880 && epNum <= 2100) || [480, 576, 720, 1080, 2160].includes(epNum));

    if (!isAbsurdEp && !isNaN(epNum) && epNum > 0) {
      if (epNum > 24 && !rawGuess?.season) {
        // Numérotation continue d'anime
        absoluteEpisode = epNum;
      } else {
        episode = epNum;
      }
    }

    if (rawGuess?.season != null) {
      const sNum = parseInt(String(rawGuess.season), 10);
      if (!isNaN(sNum) && sNum > 0 && sNum < 200) season = sNum;
    }

    // Extraction CRC32 pour animes
    const crcMatch = filename.match(/\[([A-Fa-f0-9]{8})\]/);
    if (crcMatch) {
      // Indice fort d'anime
      if (!absoluteEpisode && episode && episode > 0) {
        absoluteEpisode = episode;
      }
    }
  } else {
    // Si c'est un film : INTERDICTION FORMELLE d'avoir une saison ou un épisode
    season = undefined;
    episode = undefined;
    absoluteEpisode = undefined;
  }

  // 5. Normalisation de la qualité vidéo
  let videoQuality: string | undefined;
  const rawSize = rawGuess?.screen_size ? String(rawGuess.screen_size).toLowerCase() : '';
  if (rawSize.includes('2160') || rawSize.includes('4k')) videoQuality = '4K UHD';
  else if (rawSize.includes('1080')) videoQuality = '1080p FHD';
  else if (rawSize.includes('720')) videoQuality = '720p HD';
  else if (rawSize.includes('480')) videoQuality = '480p SD';

  // 6. Extraction CRC32
  const crcMatch = filename.match(/\[([A-Fa-f0-9]{8})\]/);
  const crc32 = crcMatch ? crcMatch[1].toUpperCase() : undefined;

  return {
    title: cleanTitle,
    originalTitle: rawGuess?.original_title ? sanitizeReleaseTags(String(rawGuess.original_title)) : undefined,
    year,
    type: mediaType,
    season,
    episode,
    absoluteEpisode,
    videoQuality,
    videoCodec: rawGuess?.video_codec ? String(rawGuess.video_codec).toUpperCase() : undefined,
    audioCodec: rawGuess?.audio_codec ? String(rawGuess.audio_codec).toUpperCase() : undefined,
    crc32,
    releaseGroup: rawGuess?.release_group ? String(rawGuess.release_group) : undefined,
  };
}
