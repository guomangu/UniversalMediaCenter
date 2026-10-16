import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export interface KaiEpisodeInfo {
  showTitle: string;
  arcName: string;
  season: number;
  episode: number;
  title: string;
  seasonEpisodeTag: string;
  displayBadge: string;
  orderIndex: number;
  isSpecial: boolean;
}

export const BAD_GUERRA_PACE_MD5 = 'a4d5e52df6fc6de1b20070552a1ba0da';

export const ONE_PACE_ARCS_MAP: Record<number, { season: number; name: string }> = {
  1: { season: 1, name: 'Romance Dawn' },
  8: { season: 2, name: 'Orange Town' },
  23: { season: 3, name: 'Syrup Village' },
  42: { season: 4, name: 'Gaimon' },
  69: { season: 5, name: 'Arlong Park' },
  96: { season: 6, name: 'Loguetown' },
  101: { season: 7, name: 'Reverse Mountain' },
  106: { season: 8, name: 'Whiskey Peak' },
  115: { season: 9, name: 'Little Garden' },
  130: { season: 10, name: 'Drum Island' },
  155: { season: 11, name: 'Arabasta' },
  237: { season: 12, name: 'Skypiea' },
  304: { season: 13, name: 'Long Ring Long Land' },
  322: { season: 14, name: 'Water Seven' },
  375: { season: 15, name: 'Enies Lobby' },
  431: { season: 16, name: 'Post-Enies Lobby' },
  442: { season: 17, name: 'Thriller Bark' },
  490: { season: 18, name: 'Sabaody Archipelago' },
  514: { season: 19, name: 'Amazon Lily' },
  525: { season: 20, name: 'Impel Down' },
  549: { season: 21, name: 'Marineford' },
  581: { season: 22, name: 'Post-War' },
  598: { season: 23, name: 'Return to Sabaody' },
  603: { season: 24, name: 'Fishman Island' },
  654: { season: 25, name: 'Punk Hazard' },
  700: { season: 26, name: 'Dressrosa' },
  801: { season: 27, name: 'Zou' },
  823: { season: 28, name: 'Whole Cake Island' },
  903: { season: 29, name: 'Reverie' },
  909: { season: 30, name: 'Wano' },
};

/**
 * Détecte si un chemin ou un titre correspond à une série animée Kai ou Pace
 */
export function isKaiOrPaceMedia(filePath: string, title?: string): boolean {
  const norm = `${filePath || ''} ${title || ''}`.toLowerCase().replace(/\\/g, '/');
  return (
    norm.includes('one pace') ||
    norm.includes('one_piece_kai') ||
    norm.includes('one piece kai') ||
    norm.includes('dragon ball z kai') ||
    norm.includes('dbz kai') ||
    norm.includes('dragon ball kai') ||
    norm.includes('naruto kai') ||
    norm.includes('bleach kai') ||
    norm.includes('fairy tail kai') ||
    norm.includes('hunter x hunter kai') ||
    /\b(?:kai|pace)\b/i.test(norm)
  );
}

/**
 * Détecte si un NFO est pollué par le faux-positif récurrent TMDb (ex: "Guerra e pace (Teatro)")
 */
export function isTaintedNfo(nfoContentOrTitle: string, tmdbId?: number | string | null): boolean {
  const str = String(nfoContentOrTitle || '').toLowerCase();
  const idStr = String(tmdbId || '');
  if (idStr === '1710755') return true;
  if (str.includes('guerra e pace') || str.includes('andrea baracco') || str.includes('stefano fresi')) {
    return true;
  }
  return false;
}

/**
 * Vérifie si un artwork correspond à l'affiche polluée "Guerra e pace"
 */
export async function isTaintedArtwork(filePath: string, fileSizeBytes?: number): Promise<boolean> {
  try {
    let size = fileSizeBytes;
    if (size === undefined) {
      const st = await fs.stat(filePath);
      size = st.size;
    }
    if (size === 217213) {
      const buf = await fs.readFile(filePath);
      const hash = crypto.createHash('md5').update(buf).digest('hex');
      if (hash === BAD_GUERRA_PACE_MD5) return true;
    }
  } catch {}
  return false;
}

/**
 * Détermine le nom de la série principale Kai / Pace
 */
export function getKaiShowTitle(filePath: string): string {
  const norm = filePath.toLowerCase().replace(/\\/g, '/');
  if (norm.includes('one pace') || norm.includes('one_piece') || norm.includes('one piece')) {
    return 'One Piece Kai';
  }
  if (norm.includes('dragon ball') || norm.includes('dbz')) {
    return 'Dragon Ball Z Kai';
  }
  if (norm.includes('naruto')) {
    return 'Naruto Kai';
  }
  if (norm.includes('bleach')) {
    return 'Bleach Kai';
  }
  if (norm.includes('fairy tail')) {
    return 'Fairy Tail Kai';
  }
  return 'Anime Kai';
}

/**
 * Analyse et résout les métadonnées spécifiques d'un épisode Kai ou One Pace
 */
export function parseKaiEpisodeInfo(filePath: string): KaiEpisodeInfo | null {
  if (!isKaiOrPaceMedia(filePath)) return null;

  const normPath = filePath.replace(/\\/g, '/');
  const filename = path.basename(normPath);
  const dirName = path.basename(path.dirname(normPath));
  const showTitle = getKaiShowTitle(normPath);

  // 1. Détection standard SxxExx pour les séries Kai formelles (ex: Dragon Ball Z Kai S01E05)
  const seMatch = filename.match(/S(\d+)E(\d+)/i) || filename.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  if (seMatch && !normPath.toLowerCase().includes('one pace') && !normPath.toLowerCase().includes('one_piece')) {
    const s = parseInt(seMatch[1], 10);
    const e = parseInt(seMatch[2], 10);
    const sStr = String(s).padStart(2, '0');
    const eStr = String(e).padStart(2, '0');
    return {
      showTitle,
      arcName: `Saison ${s}`,
      season: s,
      episode: e,
      title: `${showTitle} S${sStr}E${eStr}`,
      seasonEpisodeTag: `S${sStr}E${eStr}`,
      displayBadge: `S${sStr} • EP ${eStr}`,
      orderIndex: s * 1000 + e,
      isSpecial: s === 0,
    };
  }

  // 2. Gestion des Épisodes Spéciaux (One Pace specials, April fools, etc.)
  const isSpecial =
    /special/i.test(normPath) ||
    /april\s*fools/i.test(normPath) ||
    /omake/i.test(filename) ||
    /straw\s*hat\s*theatre/i.test(filename);

  if (isSpecial) {
    const rawName = filename
      .replace(/^\[[^\]]+\]\s*/g, '')
      .replace(/\s*\[[^\]]+\]/g, '')
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .trim();

    let epNum = 1;
    const numMatch = filename.match(/\[(\d+)(?:[-,]\d+)?\]/) || filename.match(/\b(\d+)\b/);
    if (numMatch) {
      epNum = parseInt(numMatch[1], 10);
    }

    const title = rawName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const epStr = String(epNum).padStart(2, '0');
    return {
      showTitle,
      arcName: 'Spéciaux',
      season: 0,
      episode: epNum,
      title,
      seasonEpisodeTag: `S00E${epStr}`,
      displayBadge: `SP ${epStr}`,
      orderIndex: epNum,
      isSpecial: true,
    };
  }

  // 3. Détection de l'Arc et de la Saison One Pace via le dossier parent ou le nom de fichier
  let season = 1;
  let arcName = 'Romance Dawn';

  let folderMatch = dirName.match(/\[(?:one pace|kai)\]\[(\d+)(?:[-,\s]+(?:\d+|x+))?\]\s*([^\[\]]+)/i);
  if (!folderMatch) {
    folderMatch = normPath.match(/\[(?:one pace|kai)\]\[(\d+)(?:[-,\s]+(?:\d+|x+))?\]\s*([^\[\]]+)/i);
  }

  const chapterMatch = filename.match(/chapter\s+(\d+)(?:[-,\s]+(\d+))?/i);

  if (folderMatch) {
    const startChapter = parseInt(folderMatch[1], 10);
    const rawArc = folderMatch[2].trim();

    for (const key of Object.keys(ONE_PACE_ARCS_MAP).map(Number).sort((a, b) => b - a)) {
      if (startChapter >= key) {
        season = ONE_PACE_ARCS_MAP[key].season;
        arcName = ONE_PACE_ARCS_MAP[key].name;
        break;
      }
    }

    if (!arcName || arcName === 'Episode') {
      arcName = rawArc
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  } else if (chapterMatch) {
    const startCh = parseInt(chapterMatch[1], 10);
    for (const key of Object.keys(ONE_PACE_ARCS_MAP).map(Number).sort((a, b) => b - a)) {
      if (startCh >= key) {
        season = ONE_PACE_ARCS_MAP[key].season;
        arcName = ONE_PACE_ARCS_MAP[key].name;
        break;
      }
    }
  } else {
    // Si pas de dossier [one pace][...], vérifier si un dossier d'arc simple existe
    const simpleArc = dirName.match(/^(?:\[[^\]]+\])?\s*([a-zA-Z\s\-_]+?)(?:\s*\[|$)/);
    if (simpleArc) {
      arcName = simpleArc[1].trim();
    }
  }

  // 4. Détection du numéro d'épisode dans l'arc
  let episode = 1;
  let cleanTitle = `${arcName} 01`;

  // Cas Dressrosa : chapter 700-701 [720p]
  if (chapterMatch) {
    const startCh = parseInt(chapterMatch[1], 10);
    // Dressrosa débute au chapitre 700, avançant par tranches de 2 chapitres
    episode = Math.max(1, Math.floor((startCh - 700) / 2) + 1);
    const endChStr = chapterMatch[2] ? `-${chapterMatch[2]}` : '';
    cleanTitle = `Dressrosa - Chapitre ${startCh}${endChStr}`;
  } else {
    // Format standard: [one pace][11-16] orange town 02 [480p]
    const arcEpMatch = filename.match(/(?:^|\]\s*|\b)([a-zA-Z\s\-_]+?)\s+(\d{1,2})\s*\[/);
    if (arcEpMatch) {
      episode = parseInt(arcEpMatch[2], 10);
      cleanTitle = `${arcName} ${String(episode).padStart(2, '0')}`;
    } else {
      // Fallback sur le premier chiffre isolé à la fin du nom d'arc
      const lastNumMatch = filename.match(/(\d{1,2})\s*(?:\[|\.mkv|\.mp4)/i);
      if (lastNumMatch) {
        episode = parseInt(lastNumMatch[1], 10);
        cleanTitle = `${arcName} ${String(episode).padStart(2, '0')}`;
      }
    }
  }

  const sStr = String(season).padStart(2, '0');
  const eStr = String(episode).padStart(2, '0');
  const orderIndex = season * 1000 + episode;

  return {
    showTitle,
    arcName,
    season,
    episode,
    title: cleanTitle,
    seasonEpisodeTag: `S${sStr}E${eStr}`,
    displayBadge: `S${sStr} • EP ${eStr}`,
    orderIndex,
    isSpecial: false,
  };
}
