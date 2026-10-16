export interface SeasonEpisodeInfo {
  season?: number;
  episode?: number;
  seasonEpisodeTag: string; // e.g. "S01E03" ou "E03"
  displayBadge: string;     // e.g. "S01 • EP 03" ou "EP 03"
  sortRank: number;         // (season * 10000) + episode
}

/**
 * Extrait le numéro de saison et d'épisode depuis le titre ou l'index.
 * DÉFENSE ABSOLUE :
 * - Si le nœud est un film (MOVIE) ou une saga (COLLECTION), renvoie systématiquement NULL.
 * - Ne confond JAMAIS une résolution vidéo (1920x1080, 1920x804, 1280x720) avec une saison/épisode.
 * - Si orderIndex est une année de cinéma (1880 - 2100), ne le convertit JAMAIS en saison/épisode mathématique.
 */
export function parseSeasonEpisode(
  title: string,
  orderIndex?: number | null,
  nodeType?: string | null
): SeasonEpisodeInfo | null {
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

  // 2. Format 1x02 ou 01x02 (Strictement borné pour interdire 1920x1080, 1280x720, etc.)
  const xPattern = /\b([0-9]{1,2})x([0-9]{1,3})\b/i.exec(normTitle);
  if (xPattern) {
    const s = parseInt(xPattern[1], 10);
    const e = parseInt(xPattern[2], 10);
    if (s < 50 && e < 150) {
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

  // 4a. Format E02 ou EP02 ou Épisode 2
  const epPattern = /(?:EP|E|Épisode|Episode)[\s._-]*(\d+)/i.exec(normTitle);
  if (epPattern) {
    const e = parseInt(epPattern[1], 10);
    const eStr = String(e).padStart(2, '0');

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

  // 4b. Format isolé entre tirets (ex: "Bleach - 214 - ...", "[Neutrinome] Darling in the FranXX - 02 - VOSTFR...")
  const hyphenNumberPattern = /(?:^|\s)[-_–]\s*0*([1-9]\d{0,3})\s*[-_–]/i.exec(normTitle);
  if (hyphenNumberPattern) {
    const e = parseInt(hyphenNumberPattern[1], 10);
    const eStr = String(e).padStart(2, '0');
    return {
      season: 1,
      episode: e,
      seasonEpisodeTag: `E${eStr}`,
      displayBadge: `EP ${eStr}`,
      sortRank: 10000 + e,
    };
  }

  // 4c. Format numéro de piste en tête de fichier (ex: "7 - conjonctivite.avi")
  const trackPattern = /^0*([1-9]\d{0,2})\s*[-_–]\s+[a-zA-Z]/i.exec(normTitle);
  if (trackPattern) {
    const e = parseInt(trackPattern[1], 10);
    const eStr = String(e).padStart(2, '0');
    return {
      season: 1,
      episode: e,
      seasonEpisodeTag: `E${eStr}`,
      displayBadge: `EP ${eStr}`,
      sortRank: 10000 + e,
    };
  }

  // 5. Fallback sur orderIndex UNIQUEMENT pour les épisodes ou saisons
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
