/**
 * Extrait le numéro de saison et d'épisode depuis le titre ou l'index.
 * DÉFENSE ABSOLUE :
 * - Si le nœud est un film (MOVIE) ou une saga (COLLECTION), renvoie systématiquement NULL.
 * - Si orderIndex est une année de cinéma (1880 - 2100), ne le convertit JAMAIS en saison/épisode mathématique.
 */
export function parseSeasonEpisode(title, orderIndex, nodeType) {
    // Règle 1 : Un film, une saga ou un conteneur non-épisode n'a JAMAIS de badge d'épisode
    if (nodeType && nodeType !== 'EPISODE' && nodeType !== 'SEASON') {
        return null;
    }
    const normTitle = (title || '').trim();
    // 1. Format S01E02 ou S1E2
    const sPattern = /S(\d+)[\s._-]*E(\d+)/i.exec(normTitle);
    if (sPattern) {
        const s = parseInt(sPattern[1], 10);
        const e = parseInt(sPattern[2], 10);
        const sStr = String(s).padStart(2, '0');
        const eStr = String(e).padStart(2, '0');
        return {
            season: s,
            episode: e,
            seasonEpisodeTag: `S${sStr}E${eStr}`,
            displayBadge: `S${sStr} • EP ${eStr}`,
            sortRank: s * 10000 + e,
        };
    }
    // 2. Format 1x02
    const xPattern = /(\d+)x(\d+)/i.exec(normTitle);
    if (xPattern) {
        const s = parseInt(xPattern[1], 10);
        const e = parseInt(xPattern[2], 10);
        const sStr = String(s).padStart(2, '0');
        const eStr = String(e).padStart(2, '0');
        return {
            season: s,
            episode: e,
            seasonEpisodeTag: `S${sStr}E${eStr}`,
            displayBadge: `S${sStr} • EP ${eStr}`,
            sortRank: s * 10000 + e,
        };
    }
    // 3. Format R1 / R2 (Code Geass, etc.) avec numéro d'épisode
    const rPattern = /\bR([1-9])\b.*?(\d{1,3})/i.exec(normTitle);
    if (rPattern) {
        const s = parseInt(rPattern[1], 10);
        const e = parseInt(rPattern[2], 10);
        const sStr = String(s).padStart(2, '0');
        const eStr = String(e).padStart(2, '0');
        return {
            season: s,
            episode: e,
            seasonEpisodeTag: `S${sStr}E${eStr}`,
            displayBadge: `S${sStr} • EP ${eStr}`,
            sortRank: s * 10000 + e,
        };
    }
    // 4. Format E02 ou EP02 ou Épisode 2
    const epPattern = /(?:EP|E|Épisode|Episode)[\s._-]*(\d+)/i.exec(normTitle);
    if (epPattern) {
        const e = parseInt(epPattern[1], 10);
        const eStr = String(e).padStart(2, '0');
        // Si orderIndex indique une saison encodée (ex: 2005 -> saison 2, épisode 5)
        // ATTENTION : Si orderIndex est entre 1880 et 2100, c'est une année de sortie, PAS une saison !
        const isYear = orderIndex && orderIndex >= 1880 && orderIndex <= 2100;
        if (orderIndex && orderIndex >= 1000 && !isYear) {
            const s = Math.floor(orderIndex / 1000);
            const effE = orderIndex % 1000;
            const sStr = String(s).padStart(2, '0');
            const effEStr = String(effE).padStart(2, '0');
            return {
                season: s,
                episode: effE,
                seasonEpisodeTag: `S${sStr}E${effEStr}`,
                displayBadge: `S${sStr} • EP ${effEStr}`,
                sortRank: s * 10000 + effE,
            };
        }
        return {
            episode: e,
            seasonEpisodeTag: `E${eStr}`,
            displayBadge: `EP ${eStr}`,
            sortRank: 10000 + e,
        };
    }
    // 5. Fallback sur orderIndex UNIQUEMENT pour les épisodes ou saisons
    // Ne JAMAIS inventer un épisode si nodeType est inconnu et qu'aucun motif n'est dans le titre
    if (nodeType === 'EPISODE' || nodeType === 'SEASON') {
        if (orderIndex && orderIndex > 0) {
            const isYear = orderIndex >= 1880 && orderIndex <= 2100;
            if (orderIndex >= 1000 && !isYear) {
                const s = Math.floor(orderIndex / 1000);
                const e = orderIndex % 1000;
                const sStr = String(s).padStart(2, '0');
                const eStr = String(e).padStart(2, '0');
                return {
                    season: s,
                    episode: e,
                    seasonEpisodeTag: `S${sStr}E${eStr}`,
                    displayBadge: `S${sStr} • EP ${eStr}`,
                    sortRank: s * 10000 + e,
                };
            }
            if (!isYear) {
                const eStr = String(orderIndex).padStart(2, '0');
                return {
                    episode: orderIndex,
                    seasonEpisodeTag: `E${eStr}`,
                    displayBadge: `EP ${eStr}`,
                    sortRank: 10000 + orderIndex,
                };
            }
        }
    }
    return null;
}
