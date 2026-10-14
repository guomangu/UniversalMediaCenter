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

  // 1. Détection de dossier d'Arc ou de Saison
  let groupName = 'Épisodes';
  let season: number | undefined;

  const arcMatch = /[/\\\\](\d+)[-_ ]+([a-zA-Z0-9' ]+)[/\\\\]/i.exec(fsPath);
  const filmsMatch = /[/\\\\]Films?[/\\\\]/i.exec(fsPath) || c.nodeType === 'MOVIE';
  const seasonDirMatch = /[/\\\\](?:Season|Saison)[-_ ]*(\d+)[/\\\\]/i.exec(fsPath) || /[/\\\\]S(\d+)[/\\\\]/i.exec(fsPath);

  if (filmsMatch) {
    groupName = 'Films & Spéciaux';
    season = 999;
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

  // 2. Détection du numéro d'épisode absolu ou relatif
  let episode: number | undefined;

  // A. Si absoluteOrderIndex est déjà calculé côté backend
  if (c.absoluteOrderIndex != null && c.absoluteOrderIndex > 0) {
    episode = c.absoluteOrderIndex;
  } else {
    // B. Détection format anime standard: "Bleach - 102 - Titre"
    const dashNumMatch = /(?:^|\s)-?\s*(\d{1,4})\s*-\s*/.exec(rawTitle) || /[-_](\d{1,4})[-_]/.exec(fsPath);
    // C. Détection S01E02 ou 1x02
    const sMatch = /S(\d+)[-_ ]*E(\d+)/i.exec(rawTitle) || /(\d+)x(\d+)/i.exec(rawTitle);
    // D. Détection EP02 / E02 / Épisode 2
    const epMatch = /(?:EP|E|Épisode|Episode)[-_ ]*(\d+)/i.exec(rawTitle);

    if (sMatch) {
      if (season === undefined) season = parseInt(sMatch[1], 10);
      episode = parseInt(sMatch[2], 10);
      if (groupName === 'Épisodes' && season !== undefined) {
        groupName = `Saison ${season}`;
      }
    } else if (dashNumMatch) {
      episode = parseInt(dashNumMatch[1], 10);
    } else if (epMatch) {
      episode = parseInt(epMatch[1], 10);
    } else if (c.orderIndex > 0) {
      episode = c.orderIndex;
    }
  }

  // 3. Nettoyage du titre affiché (Retirer le préfixe "Show - 102 - " pour n'avoir que le titre de l'épisode)
  let displayTitle = rawTitle
    .replace(/^.*?-\s*\d{1,4}\s*-\s*/i, '')
    .replace(/^.*?-\s*S\d+E\d+\s*-\s*/i, '')
    .trim();
  if (!displayTitle) displayTitle = rawTitle;

  // 4. Tag de badge (ex: "EP 102", "S01 • EP 02", "FILM 1")
  let tag = 'Fichier';
  if (c.nodeType === 'MOVIE' || filmsMatch) {
    tag = episode ? `FILM ${episode}` : 'FILM';
  } else if (season !== undefined && season < 999 && episode !== undefined && episode < 100) {
    tag = `S${String(season).padStart(2, '0')} • EP ${String(episode).padStart(2, '0')}`;
  } else if (episode !== undefined) {
    tag = `EP ${String(episode).padStart(2, '0')}`;
  } else if (c.displayBadge) {
    tag = c.displayBadge;
  }

  // 5. Durée formatée (ex: "24 min")
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

  // Tri des groupes (Saisons et Arcs dans l'ordre croissant, Films & Spéciaux à la fin)
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
    // Tri des épisodes au sein du groupe par numéro d'épisode puis clé de fichier
    const sortedItems = [...items].sort((a, b) => {
      if (a.episode != null && b.episode != null && a.episode !== b.episode) {
        return a.episode - b.episode;
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
