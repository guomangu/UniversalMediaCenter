import path from 'node:path';
import { resolveAnimeAcronym } from './animeAcronyms.js';
import { sanitizeReleaseTags } from '../titleCleaner.js';
function cleanReleaseTags(str) {
    return str
        .replace(/^\s*\[.*?\]/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\b(1080p|720p|2160p|4k|bluray|remux|hevc|x265|x264|vff|vostfr|multi|proper|repack|web-dl|web|aac|ac3|dts|flac)\b/gi, '')
        .replace(/[._]/g, ' ')
        .replace(/-(trailer|behindthescenes|deleted|featurette|interview)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
export function parseLexicalFilename(filePath) {
    const norm = filePath.replace(/\\/g, '/');
    const fileName = path.basename(norm, path.extname(norm));
    const dirName = path.dirname(norm);
    const parentFolder = path.basename(dirName);
    // 1. Détection des Bonus / Extras (sur le dossier direct uniquement, jamais sur l'arborescence complète)
    let isExtra = false;
    let extraType;
    if (/^(?:featurettes|extras|bonus|deleted scenes|interviews)$/i.test(parentFolder) || /\/(?:featurettes|extras|bonus|deleted scenes)\//i.test(norm)) {
        isExtra = true;
        if (/stunt|making|wall|behind/i.test(fileName))
            extraType = 'behindthescenes';
        else if (/deleted/i.test(fileName))
            extraType = 'deleted';
        else
            extraType = 'featurette';
    }
    else if (/-(trailer|behindthescenes|deleted|featurette|interview)\b/i.test(fileName)) {
        isExtra = true;
        const match = /-(trailer|behindthescenes|deleted|featurette|interview)\b/i.exec(fileName);
        extraType = match ? match[1].toLowerCase() : 'featurette';
    }
    // 2. Détection de l'édition (Director's Cut, Extended, etc.)
    let edition;
    const editionMatch = /\[Edition-(.*?)\]/i.exec(fileName) || /\b(Director's Cut|Extended Cut|Theatrical Cut|Unrated|Uncensored|Remastered)\b/i.exec(fileName);
    if (editionMatch)
        edition = editionMatch[1].trim();
    // 3. Détection de fichiers découpés en plusieurs parties (pt1, cd1)
    let partNumber;
    const partMatch = /\b(?:pt|part|cd)\s*0*([1-9])\b/i.exec(fileName);
    if (partMatch)
        partNumber = parseInt(partMatch[1], 10);
    // 4. Détection du release group
    let releaseGroup;
    const groupMatch = /^\[([a-zA-Z0-9._ -]+)\]/.exec(fileName);
    if (groupMatch && !/tmdb|imdb|tvdb|anidb|edition/i.test(groupMatch[1])) {
        releaseGroup = groupMatch[1].trim();
    }
    // 5. Détection Saison & Épisode (y compris épisodes doubles S01E01-E02)
    let seasonNumber;
    let episodeNumber;
    let endEpisodeNumber;
    let absoluteEpisodeNumber;
    let showTitle;
    let episodeTitle;
    const doubleEpMatch = /S(\d+)E(\d+)(?:[-_~]E?(\d+))/i.exec(fileName);
    const singleEpMatch = /S(\d+)E(\d+)/i.exec(fileName) || /(\d+)x(\d+)/i.exec(fileName);
    const animeAbsoluteMatch = /(?:^|[-_ ])0*(\d{1,4})(?:[-_ ])/.exec(fileName);
    if (doubleEpMatch) {
        seasonNumber = parseInt(doubleEpMatch[1], 10);
        episodeNumber = parseInt(doubleEpMatch[2], 10);
        endEpisodeNumber = parseInt(doubleEpMatch[3], 10);
        const matchIdx = doubleEpMatch.index;
        const beforePart = cleanReleaseTags(fileName.slice(0, matchIdx)).replace(/[-–—]\s*$/, '').trim();
        if (beforePart.length > 0)
            showTitle = resolveAnimeAcronym(beforePart);
        const afterPart = sanitizeReleaseTags(cleanReleaseTags(fileName.slice(matchIdx + doubleEpMatch[0].length)).replace(/^[-–—]\s*/, '')).trim();
        if (afterPart.length > 0)
            episodeTitle = afterPart;
    }
    else if (singleEpMatch) {
        seasonNumber = parseInt(singleEpMatch[1], 10);
        episodeNumber = parseInt(singleEpMatch[2], 10);
        const matchIdx = singleEpMatch.index;
        const beforePart = cleanReleaseTags(fileName.slice(0, matchIdx)).replace(/[-–—]\s*$/, '').trim();
        if (beforePart.length > 0)
            showTitle = resolveAnimeAcronym(beforePart);
        const afterPart = sanitizeReleaseTags(cleanReleaseTags(fileName.slice(matchIdx + singleEpMatch[0].length)).replace(/^[-–—]\s*/, '')).trim();
        if (afterPart.length > 0)
            episodeTitle = afterPart;
    }
    else if (animeAbsoluteMatch) {
        const candidate = parseInt(animeAbsoluteMatch[1], 10);
        if (candidate > 0 && (candidate < 1900 || candidate > 2099)) {
            absoluteEpisodeNumber = candidate;
            const matchIdx = animeAbsoluteMatch.index;
            const beforePart = cleanReleaseTags(fileName.slice(0, matchIdx)).replace(/[-–—]\s*$/, '').trim();
            if (beforePart.length > 0)
                showTitle = resolveAnimeAcronym(beforePart);
            const afterPart = sanitizeReleaseTags(cleanReleaseTags(fileName.slice(matchIdx + animeAbsoluteMatch[0].length)).replace(/^[-–—]\s*/, '')).trim();
            if (afterPart.length > 0)
                episodeTitle = afterPart;
        }
    }
    // 6. Extraction de l'année
    let year;
    const yearMatch = /\b(19\d\d|20\d\d)\b/.exec(fileName) || /\b(19\d\d|20\d\d)\b/.exec(parentFolder);
    if (yearMatch)
        year = parseInt(yearMatch[1], 10);
    // 7. Nettoyage du titre
    // sanitizeReleaseTags supprime le bloc « année + tags + groupe de release »
    // (ex: 1999.multi.1080p.bluray.x264-LOST) qui polluait les titres de films.
    let cleanTitle = sanitizeReleaseTags(fileName);
    cleanTitle = cleanTitle
        .replace(/\bS\d+E\d+(?:-E?\d+)?\b/gi, '')
        .replace(/\b\d+x\d+\b/g, '')
        .trim();
    cleanTitle = resolveAnimeAcronym(cleanTitle);
    if (episodeTitle && episodeTitle.length > 0) {
        cleanTitle = episodeTitle;
    }
    else if (!cleanTitle || cleanTitle.toLowerCase() === showTitle?.toLowerCase()) {
        if (episodeNumber || absoluteEpisodeNumber) {
            cleanTitle = `Épisode ${absoluteEpisodeNumber || episodeNumber}`;
        }
    }
    return {
        cleanTitle: cleanTitle || fileName,
        showTitle,
        episodeTitle,
        year,
        seasonNumber,
        episodeNumber,
        endEpisodeNumber,
        absoluteEpisodeNumber,
        edition,
        isExtra,
        extraType,
        partNumber,
        releaseGroup,
    };
}
