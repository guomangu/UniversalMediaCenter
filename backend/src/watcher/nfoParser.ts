import { XMLParser } from 'fast-xml-parser';
import type { ParsedNfo, ParsedActor } from './types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['genre', 'tag', 'studio', 'country', 'director', 'writer', 'actor'].includes(name),
});

export function parseNfoXml(xmlContent: string): ParsedNfo {
  const parsed = parser.parse(xmlContent);
  const root = parsed.movie || parsed.tvshow || parsed.episodedetails || {};
  const isShow = Boolean(parsed.tvshow);
  const isEpisode = Boolean(parsed.episodedetails);

  const actors: ParsedActor[] = (root.actor || []).map((a: any) => ({
    name: typeof a === 'string' ? a : a.name || 'Inconnu',
    role: typeof a === 'object' ? a.role : undefined,
    thumb: typeof a === 'object' ? a.thumb : undefined,
  }));

  const standardKeys = new Set([
    'title', 'originaltitle', 'sorttitle', 'tagline', 'plot', 'outline',
    'year', 'premiered', 'runtime', 'rating', 'genre', 'tag', 'studio',
    'country', 'director', 'credits', 'writer', 'actor', 'fileinfo', 'set'
  ]);

  const customFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(root)) {
    if (!standardKeys.has(k.toLowerCase()) && !k.startsWith('@_')) {
      customFields[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  }

  return {
    type: isShow ? 'SHOW' : isEpisode ? 'EPISODE' : 'MOVIE',
    title: root.title || 'Média sans titre',
    originalTitle: root.originaltitle,
    sortTitle: root.sorttitle,
    tagline: root.tagline,
    plot: root.plot || root.outline,
    year: root.year ? parseInt(root.year, 10) : undefined,
    premiered: root.premiered,
    runtime: root.runtime ? parseInt(root.runtime, 10) : undefined,
    rating: root.rating ? parseFloat(root.rating) : undefined,
    genres: (root.genre || []).map(String),
    tags: (root.tag || []).map(String),
    studios: (root.studio || []).map(String),
    countries: (root.country || []).map(String),
    directors: (root.director || []).map(String),
    writers: (root.writer || root.credits || []).map(String),
    actors,
    chapters: [],
    streamDetails: {},
    customFields,
  };
}
