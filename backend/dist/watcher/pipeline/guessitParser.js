import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sanitizeReleaseTags, extractYearFromText } from '../titleCleaner.js';
const execFileAsync = promisify(execFile);
/**
 * Parsing heuristique via GuessIt avec couche de validation stricte Kyoo.
 * Évite impérativement les faux positifs (ne confond jamais une résolution ou une année avec un épisode).
 */
export async function parsePathWithGuessit(filePath) {
    const normPath = filePath.replace(/\\/g, '/');
    const filename = normPath.split('/').pop() || '';
    const isFilmsPath = /\/(films|movies|marvel|action|comedy|drame|drama|spectacle)\//i.test(normPath);
    const isSeriesPath = /\/(series|séries|serie|série|anime|animes|tv|shows|show)\//i.test(normPath);
    // Détection d'un motif explicite d'épisode dans le nom de fichier ou le dossier immédiat
    const hasExplicitEpisodePattern = /S\d+[\s._-]*E\d+|\b\d+x\d+\b|\b(?:saison|season)\s*\d+[-_\s]+(?:ep|episode|e)?\s*\d+/i.test(filename) ||
        /S\d+[\s._-]*E\d+|\b\d+x\d+\b/i.test(normPath) ||
        /(?:saison|season)\s*\d+/i.test(normPath);
    let rawGuess = null;
    try {
        const { stdout } = await execFileAsync('guessit', ['-j', normPath], { timeout: 5000 });
        rawGuess = JSON.parse(stdout);
    }
    catch {
        // Si la commande CLI n'est pas disponible ou time out, fallback regex in-process
    }
    // --- COUCHE DE VALIDATION STRICTE KYOO PAR-DESSUS GUESSIT ---
    // 1. Détection de l'année (ne jamais confondre avec un épisode)
    let year;
    if (rawGuess?.year && typeof rawGuess.year === 'number' && rawGuess.year >= 1890 && rawGuess.year <= 2099) {
        year = rawGuess.year;
    }
    else {
        year = extractYearFromText(filename) || extractYearFromText(normPath);
    }
    // 2. Détection du type de média
    // RÈGLE CARDINALE : Un fichier portant un motif formel d'épisode (ex: S04E05) est TOUJOURS un épisode,
    // même s'il réside par inadvertance dans un sous-dossier contenant le mot 'films' ou 'crime'.
    let mediaType = 'movie';
    if (hasExplicitEpisodePattern || rawGuess?.type === 'episode') {
        mediaType = 'episode';
    }
    else if (isSeriesPath) {
        mediaType = 'episode';
    }
    else if (isFilmsPath) {
        mediaType = 'movie';
    }
    else if (rawGuess?.type === 'movie') {
        mediaType = 'movie';
    }
    // 3. Titre propre et nettoyé de tout préfixe de piste (ex: "01 Iron Man" -> "Iron Man")
    let titleCandidate = rawGuess?.title ? String(rawGuess.title) : filename.replace(/\.[^.]+$/, '');
    let cleanTitle = sanitizeReleaseTags(titleCandidate);
    // 4. Numéro de Saison & Épisode avec filtrage anti-faux-positifs
    let season;
    let episode;
    let absoluteEpisode;
    if (mediaType === 'episode') {
        let rawEp = rawGuess?.episode;
        if (Array.isArray(rawEp))
            rawEp = rawEp[0];
        const epNum = typeof rawEp === 'number' ? rawEp : parseInt(String(rawEp || ''), 10);
        // ANTI-FAUX-POSITIF : Si l'épisode est une année (1990-2099) ou une résolution (480, 576, 720, 1080, 2160)
        const isAbsurdEp = !isNaN(epNum) &&
            ((epNum >= 1880 && epNum <= 2100) || [360, 480, 576, 720, 1080, 2160].includes(epNum));
        if (!isAbsurdEp && !isNaN(epNum) && epNum > 0) {
            if (epNum > 24 && !rawGuess?.season) {
                // Numérotation continue d'anime
                absoluteEpisode = epNum;
            }
            else {
                episode = epNum;
            }
        }
        if (rawGuess?.season != null) {
            const sNum = parseInt(String(rawGuess.season), 10);
            if (!isNaN(sNum) && sNum > 0 && sNum < 200)
                season = sNum;
        }
        // Extraction de secours depuis la regex si Guessit a manqué season/episode
        if (season === undefined || episode === undefined) {
            const sxxExxMatch = filename.match(/S(\d+)[\s._-]*E(\d+)/i) || normPath.match(/S(\d+)[\s._-]*E(\d+)/i);
            if (sxxExxMatch) {
                if (season === undefined)
                    season = parseInt(sxxExxMatch[1], 10);
                if (episode === undefined)
                    episode = parseInt(sxxExxMatch[2], 10);
            }
            else {
                const xMatch = filename.match(/\b(\d{1,2})x(\d{1,3})\b/i);
                if (xMatch) {
                    if (season === undefined)
                        season = parseInt(xMatch[1], 10);
                    if (episode === undefined)
                        episode = parseInt(xMatch[2], 10);
                }
            }
        }
        // Extraction CRC32 pour animes
        const crcMatch = filename.match(/\[([A-Fa-f0-9]{8})\]/);
        if (crcMatch) {
            // Indice fort d'anime
            if (!absoluteEpisode && episode && episode > 0) {
                absoluteEpisode = episode;
            }
        }
    }
    else {
        // Si c'est un film : INTERDICTION FORMELLE d'avoir une saison ou un épisode
        season = undefined;
        episode = undefined;
        absoluteEpisode = undefined;
    }
    // 5. Normalisation de la qualité vidéo
    let videoQuality;
    const rawSize = rawGuess?.screen_size ? String(rawGuess.screen_size).toLowerCase() : '';
    if (rawSize.includes('2160') || rawSize.includes('4k'))
        videoQuality = '4K UHD';
    else if (rawSize.includes('1080'))
        videoQuality = '1080p FHD';
    else if (rawSize.includes('720'))
        videoQuality = '720p HD';
    else if (rawSize.includes('480'))
        videoQuality = '480p SD';
    else if (rawSize.includes('360'))
        videoQuality = '360p SD';
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
