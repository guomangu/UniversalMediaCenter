import path from 'node:path';
/**
 * Analyse les sous-dossiers entre la racine de la série et le fichier média
 */
export function analyzeFolderGrouping(filePath, showDir) {
    const normFile = filePath.replace(/\\/g, '/');
    const normShow = showDir.replace(/\\/g, '/');
    const relPath = path.relative(normShow, path.dirname(normFile));
    let isExtra = false;
    let extraType;
    let isMovie = false;
    let seasonNumber;
    let groupTitle;
    // Détection des bonus / coulisses dans les sous-dossiers stricts (ex: "Featurettes", "Bonus", "Extras")
    if (/(?:^|\/)(?:featurettes|extras|bonus|deleted scenes|interviews)(?:$|\/)/i.test(relPath)) {
        isExtra = true;
        if (/behind|making|stunt|wall/i.test(normFile))
            extraType = 'behindthescenes';
        else if (/deleted/i.test(normFile))
            extraType = 'deleted';
        else
            extraType = 'featurette';
        return { isExtra, extraType, groupTitle: 'Bonus & Coulisses' };
    }
    // Détection d'un dossier Films / Spéciaux
    if (/^Films?(\/|$)/i.test(relPath) || /\/Films?(\/|$)/i.test(relPath)) {
        isMovie = true;
        groupTitle = 'Films & Spéciaux';
        seasonNumber = 999;
        return { isExtra: false, isMovie, groupTitle, seasonNumber };
    }
    // Détection d'un Arc narratif (ex: "01- Soul Society", "02- The Bount")
    const arcMatch = /(?:^|\/)(\d{1,2})[-_ ]+([a-zA-Z0-9' ]+)(?:$|\/)/.exec(relPath);
    if (arcMatch) {
        const arcNum = parseInt(arcMatch[1], 10);
        const arcLabel = arcMatch[2].trim();
        groupTitle = `${String(arcNum).padStart(2, '0')} • ${arcLabel}`;
        seasonNumber = arcNum;
        return { isExtra: false, isMovie: false, groupTitle, seasonNumber };
    }
    // Détection d'un dossier Saison standard (ex: "Season 1", "Saison 2", "S01")
    const seasonMatch = /(?:^|\/)(?:Season|Saison|S)[-_ ]*(\d{1,2})(?:$|\/)/i.exec(relPath);
    if (seasonMatch) {
        seasonNumber = parseInt(seasonMatch[1], 10);
        groupTitle = `Saison ${seasonNumber}`;
        return { isExtra: false, isMovie: false, groupTitle, seasonNumber };
    }
    return { isExtra: false, isMovie: false };
}
