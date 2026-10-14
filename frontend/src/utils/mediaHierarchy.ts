export interface ParsedChildNode {
  node: any;
  season?: number;
  episode?: number;
  tag: string;
  fsSortKey: string;
}

export interface EpisodeSectionGroup {
  id: string;
  title: string;
  items: ParsedChildNode[];
}

export function parseChildNode(c: any): ParsedChildNode {
  const title = c.title || '';
  const fsPath = c.videoFilePath || c.nfoFilePath || title;
  const fsSortKey = fsPath.toLowerCase();

  // 1. Détection saison & épisode combinés (ex: S01E05 ou 1x05)
  const sMatch = /S(\d+)[\s._-]*E(\d+)/i.exec(title) || /(\d+)x(\d+)/i.exec(title);
  if (sMatch) {
    const s = parseInt(sMatch[1], 10);
    const e = parseInt(sMatch[2], 10);
    return {
      node: c,
      season: s,
      episode: e,
      tag: `S${String(s).padStart(2, '0')} • EP ${String(e).padStart(2, '0')}`,
      fsSortKey,
    };
  }

  // 2. Détection saison isolée (titre ou chemin dossier)
  let season: number | undefined;
  const sOnly =
    /(?:Season|Saison)[\s._-]*(\d+)/i.exec(title) ||
    /[/\\](?:Season|Saison)[\s._-]*(\d+)[/\\]/i.exec(fsPath) ||
    /[/\\]S(\d+)[/\\]/i.exec(fsPath);
  if (sOnly) season = parseInt(sOnly[1], 10);

  // 3. Détection épisode isolé (titre ou nom de fichier)
  let episode: number | undefined;
  const epMatch =
    /(?:EP|E|Épisode|Episode)[\s._-]*(\d+)/i.exec(title) ||
    /[/\\][^/\\]*?(?:EP|E|Épisode|Episode)[\s._-]*(\d+)/i.exec(fsPath);
  if (epMatch) {
    episode = parseInt(epMatch[1], 10);
  } else if (!season && c.orderIndex > 0) {
    episode = c.orderIndex;
  }

  let tag = 'Fichier';
  if (season !== undefined && episode !== undefined) {
    tag = `S${String(season).padStart(2, '0')} • EP ${String(episode).padStart(2, '0')}`;
  } else if (episode !== undefined) {
    tag = `EP ${String(episode).padStart(2, '0')}`;
  } else if (season !== undefined) {
    tag = `S${String(season).padStart(2, '0')}`;
  }

  return { node: c, season, episode, tag, fsSortKey };
}

export function buildMediaHierarchy(children: any[]): EpisodeSectionGroup[] {
  if (!children || children.length === 0) return [];
  const parsed = children.map(parseChildNode);

  const hasPeerWithSeason = parsed.some((c) => c.season !== undefined);
  const hasPeerWithEpisode = parsed.some((c) => c.episode !== undefined);

  // Tri naturel basé sur l'ordre du système de fichiers
  const fsCompare = (a: ParsedChildNode, b: ParsedChildNode) =>
    a.fsSortKey.localeCompare(b.fsSortKey, undefined, { numeric: true, sensitivity: 'base' });

  // Regroupement tolérant par saison
  const seasonBuckets = new Map<number | 'UNKNOWN', ParsedChildNode[]>();
  for (const item of parsed) {
    const key = hasPeerWithSeason ? (item.season !== undefined ? item.season : 'UNKNOWN') : 1;
    if (!seasonBuckets.has(key)) seasonBuckets.set(key, []);
    seasonBuckets.get(key)!.push(item);
  }

  // Tri vertical : Saisons numériques croissantes d'abord, 'UNKNOWN' ("Saison inconnue") EN DERNIER
  const sortedSeasonKeys = Array.from(seasonBuckets.keys()).sort((a, b) => {
    if (a === 'UNKNOWN') return 1;
    if (b === 'UNKNOWN') return -1;
    return (a as number) - (b as number);
  });

  const sections: EpisodeSectionGroup[] = [];

  for (const key of sortedSeasonKeys) {
    const items = seasonBuckets.get(key)!;
    const isUnknownSeason = key === 'UNKNOWN';
    const seasonLabel = isUnknownSeason ? 'Saison inconnue' : (hasPeerWithSeason ? `Saison ${key}` : 'Épisodes');

    const withEp = items
      .filter((i) => i.episode !== undefined)
      .sort((a, b) => a.episode! - b.episode! || fsCompare(a, b));
    const withoutEp = items.filter((i) => i.episode === undefined).sort(fsCompare);

    if (hasPeerWithEpisode && withoutEp.length > 0) {
      if (withEp.length > 0) {
        sections.push({
          id: `${key}-with-ep`,
          title: `${seasonLabel} (${withEp.length} épisode${withEp.length > 1 ? 's' : ''})`,
          items: withEp,
        });
      }
      sections.push({
        id: `${key}-unknown-ep`,
        title: isUnknownSeason
          ? `Saison inconnue — Épisode inconnu (${withoutEp.length})`
          : hasPeerWithSeason
          ? `${seasonLabel} — Épisode inconnu (${withoutEp.length})`
          : `Épisode inconnu (${withoutEp.length})`,
        items: withoutEp,
      });
    } else {
      const sortedItems = hasPeerWithEpisode ? withEp : items.sort(fsCompare);
      sections.push({
        id: `${key}-all`,
        title: `${seasonLabel} (${sortedItems.length} ${
          hasPeerWithEpisode ? `épisode${sortedItems.length > 1 ? 's' : ''}` : 'médias'
        })`,
        items: sortedItems,
      });
    }
  }

  return sections;
}
