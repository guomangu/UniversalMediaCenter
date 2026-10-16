import path from 'node:path';
import { isKaiOrPaceMedia, parseKaiEpisodeInfo } from './kaiPaceResolver.js';
/**
 * Analyse les sous-dossiers et le fichier pour détecter le regroupement (Saison, Arc, Extra, Film)
 */
export function analyzeFolderGrouping(filePath, showDir) {
    const normFile = filePath.replace(/\\/g, '/');
    const normShow = showDir.replace(/\\/g, '/');
    const relPath = path.relative(normShow, path.dirname(normFile));
    const fileName = path.basename(normFile);
    let isExtra = false;
    let extraType;
    let isMovie = false;
    let seasonNumber;
    let groupTitle;
    // 1. Détection universelle des bonus / coulisses / trailers / samples (dossiers et noms de fichiers)
    if (/(?:^|\/)(?:featurettes|extras|bonus|deleted[\s._-]?scenes|behind[\s._-]?the[\s._-]?scenes|interviews|samples|trailers|teasers|making[\s._-]?of)(?:$|\/)/i.test(relPath) ||
        /(?:[-._ ]|\b)(?:trailer|teaser|sample|featurette|behind[\s._-]?the[\s._-]?scenes|deleted[\s._-]?scenes|making[\s._-]?of|ncop\d*|nced\d*|pv\d*|cm\d*)(?:[-._ ]|\.|$)/i.test(fileName)) {
        isExtra = true;
        if (/behind|making|stunt|wall/i.test(normFile))
            extraType = 'behindthescenes';
        else if (/deleted/i.test(normFile))
            extraType = 'deleted';
        else if (/trailer|teaser/i.test(normFile))
            extraType = 'trailer';
        else if (/sample/i.test(normFile))
            extraType = 'other';
        else if (/ncop|nced|pv|cm/i.test(normFile))
            extraType = 'other';
        else
            extraType = 'featurette';
        return { isExtra, extraType, groupTitle: 'Bonus & Coulisses' };
    }
    // 2. Détection prioritaire Kai / One Pace (Arcs narratifs chronologiques & éditions condensées)
    if (isKaiOrPaceMedia(normFile)) {
        const kai = parseKaiEpisodeInfo(normFile);
        if (kai) {
            if (kai.isSpecial) {
                return { isExtra: false, isMovie: false, groupTitle: 'Spéciaux & OAVs', seasonNumber: 0 };
            }
            const sStr = String(kai.season).padStart(2, '0');
            return {
                isExtra: false,
                isMovie: false,
                groupTitle: `${sStr} • ${kai.arcName}`,
                seasonNumber: kai.season,
            };
        }
    }
    // 3. Détection d'un dossier Films / Spéciaux
    if (/^Films?(\/|$)/i.test(relPath) || /\/Films?(\/|$)/i.test(relPath)) {
        isMovie = true;
        groupTitle = 'Films & Spéciaux';
        seasonNumber = 999;
        return { isExtra: false, isMovie, groupTitle, seasonNumber };
    }
    // 4. Détection Picture Drama (spécifique Code Geass, etc.)
    if (/Picture Drama/i.test(relPath) || /Picture Drama/i.test(fileName)) {
        return { isExtra: false, isMovie: false, groupTitle: 'Picture Drama', seasonNumber: 998 };
    }
    // 5. Détection format R1 / R2 (Code Geass, etc.)
    const rMatch = /(?:^|\/|[ _-])R([1-9])\b/i.exec(relPath);
    if (rMatch) {
        seasonNumber = parseInt(rMatch[1], 10);
        groupTitle = `Saison ${seasonNumber}`;
        return { isExtra: false, isMovie: false, groupTitle, seasonNumber };
    }
    // 6. Détection d'un Arc narratif classique (ex: "01- Soul Society", "02- The Bount")
    const arcMatch = /(?:^|\/)(\d{1,2})[-_ ]+([a-zA-Z0-9' ]+)(?:$|\/)/.exec(relPath);
    if (arcMatch) {
        const arcNum = parseInt(arcMatch[1], 10);
        const arcLabel = arcMatch[2].trim();
        groupTitle = `${String(arcNum).padStart(2, '0')} • ${arcLabel}`;
        seasonNumber = arcNum;
        return { isExtra: false, isMovie: false, groupTitle, seasonNumber };
    }
    // 7. Détection d'un dossier Saison standard dans relPath (ex: "Season 1", "Saison 2", "S01", "Part 1", "Cour 1")
    const seasonMatch = /(?:^|\/)(?:Season|Saison|Part|Cour|S)[-_ ]*(\d{1,2})(?:$|\/)/i.exec(relPath);
    if (seasonMatch) {
        seasonNumber = parseInt(seasonMatch[1], 10);
        groupTitle = `Saison ${seasonNumber}`;
        return { isExtra: false, isMovie: false, groupTitle, seasonNumber };
    }
    // 8. Détection d'un dossier Saison dans le chemin complet (ex: "Peaky Blinders - Saison 4 (2017)")
    const fullPathSeasonMatch = /(?:^|\/|[ _-])(?:Season|Saison|Part|Cour)[-_ ]*0*(\d{1,2})\b/i.exec(normFile);
    if (fullPathSeasonMatch) {
        seasonNumber = parseInt(fullPathSeasonMatch[1], 10);
        groupTitle = `Saison ${seasonNumber}`;
        return { isExtra: false, isMovie: false, groupTitle, seasonNumber };
    }
    // 9. Fallback sur le nom de fichier lui-même (ex: "Code Geass S02E01")
    const fileSeasonMatch = /S(\d+)[\s._-]*E(\d+)/i.exec(fileName);
    if (fileSeasonMatch) {
        seasonNumber = parseInt(fileSeasonMatch[1], 10);
        groupTitle = `Saison ${seasonNumber}`;
        return { isExtra: false, isMovie: false, groupTitle, seasonNumber };
    }
    return { isExtra: false, isMovie: false };
}
/**
 * Teste immédiatement si un chemin de fichier ou de dossier correspond à un extra/bonus/trailer
 */
export function isExtraMediaFile(filePath) {
    const norm = filePath.replace(/\\/g, '/');
    const base = path.basename(norm);
    return (/(?:^|\/)(?:featurettes|extras|bonus|deleted[\s._-]?scenes|behind[\s._-]?the[\s._-]?scenes|interviews|samples|trailers|teasers|making[\s._-]?of)(?:$|\/)/i.test(norm) ||
        /(?:[-._ ]|\b)(?:trailer|teaser|sample|featurette|behind[\s._-]?the[\s._-]?scenes|deleted[\s._-]?scenes|making[\s._-]?of|ncop\d*|nced\d*|pv\d*|cm\d*)(?:[-._ ]|\.|$)/i.test(base));
}
