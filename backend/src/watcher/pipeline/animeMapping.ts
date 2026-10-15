export interface AnimeSeasonEpisodeResolution {
  season: number;
  episode: number;
  absoluteEpisode: number;
  seasonEpisodeTag: string; // e.g. "S07E29"
  displayBadge: string;     // e.g. "S07 • EP 29 (Abs. 294)" ou "EP 294"
}

interface SeasonRange {
  season: number;
  start: number;
  end: number;
  offset: number; // Numéro d'épisode dans la saison = absolute - offset
}

/**
 * Tables de mapping Anime-Lists / TheXEM pour les séries animées à numérotation continue
 * Permet de recalculer le couple (Saison, Épisode) exact attendu par TMDb / TVDB
 */
const KNOWN_ANIME_MAPS: Record<string, SeasonRange[]> = {
  bleach: [
    { season: 1, start: 1, end: 20, offset: 0 },
    { season: 2, start: 21, end: 41, offset: 20 },
    { season: 3, start: 42, end: 63, offset: 41 },
    { season: 4, start: 64, end: 91, offset: 63 },
    { season: 5, start: 92, end: 109, offset: 91 },
    { season: 6, start: 110, end: 131, offset: 109 },
    { season: 7, start: 132, end: 151, offset: 131 },
    { season: 8, start: 152, end: 167, offset: 151 },
    { season: 9, start: 168, end: 189, offset: 167 },
    { season: 10, start: 190, end: 205, offset: 189 },
    { season: 11, start: 206, end: 212, offset: 205 },
    { season: 12, start: 213, end: 229, offset: 212 },
    { season: 13, start: 230, end: 265, offset: 229 },
    { season: 14, start: 266, end: 316, offset: 265 },
    { season: 15, start: 317, end: 342, offset: 316 },
    { season: 16, start: 343, end: 366, offset: 342 },
  ],
  gintama: [
    { season: 1, start: 1, end: 49, offset: 0 },
    { season: 2, start: 50, end: 99, offset: 49 },
    { season: 3, start: 100, end: 150, offset: 99 },
    { season: 4, start: 151, end: 201, offset: 150 },
    { season: 5, start: 202, end: 252, offset: 201 },
    { season: 6, start: 253, end: 265, offset: 252 },
    { season: 7, start: 266, end: 316, offset: 265 },
    { season: 8, start: 317, end: 328, offset: 316 },
    { season: 9, start: 329, end: 341, offset: 328 },
    { season: 10, start: 342, end: 367, offset: 341 },
  ],
  naruto: [
    { season: 1, start: 1, end: 35, offset: 0 },
    { season: 2, start: 36, end: 83, offset: 35 },
    { season: 3, start: 84, end: 131, offset: 83 },
    { season: 4, start: 132, end: 185, offset: 131 },
    { season: 5, start: 186, end: 220, offset: 185 },
  ],
  'naruto shippuden': [
    { season: 1, start: 1, end: 32, offset: 0 },
    { season: 2, start: 33, end: 53, offset: 32 },
    { season: 3, start: 54, end: 71, offset: 53 },
    { season: 4, start: 72, end: 88, offset: 71 },
    { season: 5, start: 89, end: 112, offset: 88 },
    { season: 6, start: 113, end: 143, offset: 112 },
    { season: 7, start: 144, end: 151, offset: 143 },
    { season: 8, start: 152, end: 175, offset: 151 },
    { season: 9, start: 176, end: 196, offset: 175 },
    { season: 10, start: 197, end: 221, offset: 196 },
    { season: 11, start: 222, end: 242, offset: 221 },
    { season: 12, start: 243, end: 275, offset: 242 },
    { season: 13, start: 276, end: 295, offset: 275 },
    { season: 14, start: 296, end: 320, offset: 295 },
    { season: 15, start: 321, end: 348, offset: 320 },
    { season: 16, start: 349, end: 361, offset: 348 },
    { season: 17, start: 362, end: 372, offset: 361 },
    { season: 18, start: 373, end: 393, offset: 372 },
    { season: 19, start: 394, end: 413, offset: 393 },
    { season: 20, start: 414, end: 479, offset: 413 },
    { season: 21, start: 480, end: 500, offset: 479 },
  ],
  'hunter x hunter': [
    { season: 1, start: 1, end: 26, offset: 0 },
    { season: 2, start: 27, end: 38, offset: 26 },
    { season: 3, start: 39, end: 58, offset: 38 },
    { season: 4, start: 59, end: 75, offset: 58 },
    { season: 5, start: 76, end: 136, offset: 75 },
    { season: 6, start: 137, end: 148, offset: 136 },
  ],
  'attack on titan': [
    { season: 1, start: 1, end: 25, offset: 0 },
    { season: 2, start: 26, end: 37, offset: 25 },
    { season: 3, start: 38, end: 59, offset: 37 },
    { season: 4, start: 60, end: 89, offset: 59 },
  ],
};

/**
 * Détecte si un fichier ou média est un anime
 */
export function isAnimeMedia(showTitle?: string | null, filePath?: string | null): boolean {
  const normTitle = (showTitle || '').toLowerCase();
  const normPath = (filePath || '').toLowerCase();

  if (normPath.includes('/anime/') || normPath.includes('/animes/')) return true;
  if (/\[[a-f0-9]{8}\]/i.test(normPath)) return true; // Hash CRC32

  for (const name of Object.keys(KNOWN_ANIME_MAPS)) {
    if (normTitle.includes(name) || normPath.includes(name)) return true;
  }

  return false;
}

/**
 * Résout le couple (Saison, Épisode) TMDb depuis un numéro d'épisode absolu d'anime
 */
export function resolveAnimeSeasonEpisode(
  showTitle: string,
  absoluteEp: number,
  filePath?: string | null
): AnimeSeasonEpisodeResolution | null {
  if (absoluteEp <= 0) return null;

  const key = Object.keys(KNOWN_ANIME_MAPS).find((k) =>
    showTitle.toLowerCase().includes(k) || (filePath && filePath.toLowerCase().includes(k))
  );

  if (key) {
    const ranges = KNOWN_ANIME_MAPS[key];
    const match = ranges.find((r) => absoluteEp >= r.start && absoluteEp <= r.end);
    if (match) {
      const s = match.season;
      const e = absoluteEp - match.offset;
      const sStr = String(s).padStart(2, '0');
      const eStr = String(e).padStart(2, '0');
      return {
        season: s,
        episode: e,
        absoluteEpisode: absoluteEp,
        seasonEpisodeTag: `S${sStr}E${eStr}`,
        displayBadge: `S${sStr} • EP ${eStr}`,
      };
    }
  }

  // Fallback si anime inconnu avec épisode > 24 sans saison explicite
  const eStr = String(absoluteEp).padStart(2, '0');
  return {
    season: 1,
    episode: absoluteEp,
    absoluteEpisode: absoluteEp,
    seasonEpisodeTag: `E${eStr}`,
    displayBadge: `EP ${eStr}`,
  };
}
