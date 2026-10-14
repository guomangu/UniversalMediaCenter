export interface SeasonEpisodeInfo {
  season?: number;
  episode?: number;
  seasonEpisodeTag: string; // e.g. "S01E03" ou "E03"
  displayBadge: string;     // e.g. "S01 • EP 03" ou "EP 03"
  sortRank: number;         // (season * 10000) + episode
}

/**
 * Extrait le numéro de saison et d'épisode depuis le titre ou l'index
 * Détecte les formats: S01E05, S1E5, 1x05, E05, EP05, R1, R2, ou encodage orderIndex >= 1000 (saison * 1000 + episode)
 */
export function parseSeasonEpisode(
  title: string,
  orderIndex?: number | null
): SeasonEpisodeInfo | null {
  const normTitle = title || '';

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
  const xPattern = /(\d+)x(\\d+)/i.exec(normTitle);
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

    // Si orderIndex indique une saison > 1 (ex: 2005 -> saison 2, épisode 5)
    if (orderIndex && orderIndex >= 1000) {
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

  // 5. Fallback sur orderIndex
  if (orderIndex && orderIndex > 0) {
    // Si orderIndex >= 1000, c'est l'encodage conventionnel d'une saison (season * 1000 + episode)
    if (orderIndex >= 1000) {
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

    const eStr = String(orderIndex).padStart(2, '0');
    return {
      episode: orderIndex,
      seasonEpisodeTag: `E${eStr}`,
      displayBadge: `EP ${eStr}`,
      sortRank: 10000 + orderIndex,
    };
  }

  return null;
}
