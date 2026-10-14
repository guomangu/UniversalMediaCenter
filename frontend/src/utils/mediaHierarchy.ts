export interface ParsedChildNode {
  node: any;
  season?: number;
  episode?: number;
  groupName: string;
  tag: string;
  displayTitle: string;
  durationLabel?: string;
  fsSortKey: string;
}

export interface EpisodeSectionGroup {
  id: string;
  title: string;
  shortLabel: string;
  count: number;
  items: ParsedChildNode[];
}

export function parseChildNode(c: any): ParsedChildNode {
  const rawTitle = c.title || '';
  const fsPath = c.videoFilePath || c.nfoFilePath || rawTitle;
  const fsSortKey = fsPath.toLowerCase();

  let groupName = 'Épisodes';
  let season: number | undefined;
  let episode: number | undefined;

  const filmsMatch = /[/\\\\]Films?[/\\\\]/i.test(fsPath) || c.nodeType === 'MOVIE';
  const picDramaMatch = /Picture Drama/i.test(fsPath) || /Picture Drama/i.test(rawTitle);

  // 1. Détection prioritaire par nom de fichier / titre explicite SxxExx
  const sMatch =
    /S(\d+)[\s._-]*E(\d+)/i.exec(rawTitle) ||
    /S(\d+)[\s._-]*E(\d+)/i.exec(fsPath) ||
    /(\d+)x(\d+)/i.exec(rawTitle);

  if (sMatch) {
    season = parseInt(sMatch[1], 10);
    episode = parseInt(sMatch[2], 10);
    groupName = `Saison ${season}`;
  }

  // 2. Détection par dossier d'Arc ou de Saison spécifique
  if (filmsMatch) {
    groupName = 'Films & Spéciaux';
    season = 999;
  } else if (picDramaMatch) {
    groupName = 'Picture Drama';
    season = 998;
  } else if (!sMatch) {
    // A. Détection R1 / R2 (Code Geass, etc.)
    const rMatch = /(?:^|[/\\\\]|[ _-])R([1-9])\b/i.exec(fsPath);
    // B. Détection format anime: "01- Soul Society"
    const arcMatch = /[/\\\\](\d{1,2})[-_ ]+([a-zA-Z0-9' ]+)[/\\\\]/i.exec(fsPath);
    // C. Détection standard: Season 1, Saison 2, Part 1, Cour 1
    const seasonDirMatch =
      /[/\\\\](?:Season|Saison|Part|Cour|S)[-_ ]*(\d{1,2})[/\\\\]/i.exec(fsPath) ||
      /[/\\\\]S(\d{1,2})[/\\\\]/i.exec(fsPath);

    if (rMatch) {
      season = parseInt(rMatch[1], 10);
      groupName = `Saison ${season}`;
    } else if (arcMatch) {
      const arcNum = parseInt(arcMatch[1], 10);
      const arcLabel = arcMatch[2].trim();
      groupName = `${String(arcNum).padStart(2, '0')} • ${arcLabel}`;
      season = arcNum;
    } else if (seasonDirMatch) {
      const sNum = parseInt(seasonDirMatch[1], 10);
      groupName = `Saison ${sNum}`;
      season = sNum;
    }
  }

  // 3. Décodage depuis orderIndex si orderIndex >= 1000 (saison * 1000 + episode)
  if (c.orderIndex && c.orderIndex >= 1000) {
    const calcSeason = Math.floor(c.orderIndex / 1000);
    const calcEp = c.orderIndex % 1000;
    if (season === undefined) season = calcSeason;
    if (episode === undefined) episode = calcEp;
    if (groupName === 'Épisodes' && season !== undefined) {
      groupName = `Saison ${season}`;
    }
  }

  // 4. Fallback sur le numéro d'épisode si pas encore extrait
  if (episode === undefined) {
    if (c.absoluteOrderIndex != null && c.absoluteOrderIndex > 0 && c.absoluteOrderIndex < 1000) {
      episode = c.absoluteOrderIndex;
    } else {
      const dashNumMatch = /(?:^|\s)-?\s*(\d{1,4})\s*-\s*/.exec(rawTitle) || /[-_](\d{1,4})[-_]/.exec(fsPath);
      const epMatch = /(?:EP|E|Épisode|Episode)[-_ ]*(\d+)/i.exec(rawTitle);
      if (dashNumMatch) {
        episode = parseInt(dashNumMatch[1], 10);
      } else if (epMatch) {
        episode = parseInt(epMatch[1], 10);
      } else if (c.orderIndex > 0) {
        episode = c.orderIndex >= 1000 ? c.orderIndex % 1000 : c.orderIndex;
      }
    }
  }

  // 5. Nettoyage du titre affiché
  let displayTitle = rawTitle
    .replace(/^.*?-\s*\d{1,4}\s*-\s*/i, '')
    .replace(/^.*?-\s*S\d+E\d+\s*-\s*/i, '')
    .trim();
  if (!displayTitle) displayTitle = rawTitle;

  // 6. Tag de badge sans ambiguïté (jamais "2001", toujours "S02 • EP 01")
  let tag = 'Fichier';
  if (c.nodeType === 'MOVIE' || filmsMatch) {
    tag = episode ? `FILM ${episode}` : 'FILM';
  } else if (season !== undefined && season > 0 && season < 990 && episode !== undefined) {
    tag = `S${String(season).padStart(2, '0')} • EP ${String(episode).padStart(2, '0')}`;
  } else if (c.displayBadge && !/\b20\d\d\b/.test(c.displayBadge)) {
    tag = c.displayBadge;
  } else if (episode !== undefined) {
    tag = `EP ${String(episode).padStart(2, '0')}`;
  }

  // 7. Durée formatée
  let durationLabel: string | undefined;
  if (c.runtimeSeconds && c.runtimeSeconds > 0) {
    const mins = Math.round(c.runtimeSeconds / 60);
    durationLabel = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins} min`;
  }

  return {
    node: c,
    season,
    episode,
    groupName,
    tag,
    displayTitle,
    durationLabel,
    fsSortKey,
  };
}

export function buildMediaHierarchy(children: any[]): EpisodeSectionGroup[] {
  if (!children || children.length === 0) return [];
  const parsed = children.map(parseChildNode);

  // Regroupement par groupName (Arc ou Saison)
  const groupsMap = new Map<string, { season?: number; items: ParsedChildNode[] }>();

  for (const item of parsed) {
    const key = item.groupName;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { season: item.season, items: [] });
    }
    groupsMap.get(key)!.items.push(item);
  }

  // Tri des groupes (Saisons et Arcs dans l'ordre croissant, Picture Drama et Films à la fin)
  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
    const aData = groupsMap.get(a)!;
    const bData = groupsMap.get(b)!;
    const aSeason = aData.season ?? 500;
    const bSeason = bData.season ?? 500;
    if (aSeason !== bSeason) return aSeason - bSeason;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const sections: EpisodeSectionGroup[] = [];

  for (const key of sortedKeys) {
    const { items } = groupsMap.get(key)!;
    // Tri déterministe au sein de chaque groupe : d'abord Saison, puis Épisode, puis orderIndex
    const sortedItems = [...items].sort((a, b) => {
      const aSeason = a.season ?? 1;
      const bSeason = b.season ?? 1;
      if (aSeason !== bSeason) return aSeason - bSeason;

      if (a.episode != null && b.episode != null && a.episode !== b.episode) {
        return a.episode - b.episode;
      }
      if (a.node.orderIndex !== b.node.orderIndex) {
        return a.node.orderIndex - b.node.orderIndex;
      }
      return a.fsSortKey.localeCompare(b.fsSortKey, undefined, { numeric: true, sensitivity: 'base' });
    });

    sections.push({
      id: key,
      title: `${key} (${sortedItems.length} élément${sortedItems.length > 1 ? 's' : ''})`,
      shortLabel: key,
      count: sortedItems.length,
      items: sortedItems,
    });
  }

  return sections;
}
