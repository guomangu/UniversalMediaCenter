export interface SeasonEpisodeInfo {
  season: number;
  episode: number;
  seasonEpisodeTag: string; // e.g. "S01E03"
  displayBadge: string;     // e.g. "S01 • EP 03"
  sortRank: number;         // (season * 10000) + episode
}

/**
 * Extrait le numéro de saison et d'épisode depuis le titre ou l'index
 * Détecte les formats: S01E05, S1E5, 1x05, E05, EP05, Épisode 5, etc.
 */
export function parseSeasonEpisode(
  title: string,
  orderIndex?: number | null
): SeasonEpisodeInfo | null {
  if (!title) return null;

  // Format S01E02 ou S1E2
  const sPattern = /S(\d+)[\s._-]*E(\d+)/i.exec(title);
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

  // Format 1x02
  const xPattern = /(\d+)x(\d+)/i.exec(title);
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

  // Format E02 ou EP02 ou Épisode 2
  const epPattern = /(?:EP|E|Épisode|Episode)[\s._-]*(\d+)/i.exec(title);
  if (epPattern) {
    const e = parseInt(epPattern[1], 10);
    const eStr = String(e).padStart(2, '0');
    return {
      season: 1,
      episode: e,
      seasonEpisodeTag: `E${eStr}`,
      displayBadge: `EP ${eStr}`,
      sortRank: 10000 + e,
    };
  }

  // Fallback sur orderIndex
  if (orderIndex && orderIndex > 0) {
    const eStr = String(orderIndex).padStart(2, '0');
    return {
      season: 1,
      episode: orderIndex,
      seasonEpisodeTag: `E${eStr}`,
      displayBadge: `EP ${eStr}`,
      sortRank: 10000 + orderIndex,
    };
  }

  return null;
}
