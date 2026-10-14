import { XMLParser } from 'fast-xml-parser';
import { cleanMediaTitle } from './titleCleaner.js';
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['genre', 'tag', 'studio', 'country', 'director', 'writer', 'actor'].includes(name),
});
export function parseNfoXml(xmlContent) {
    const parsed = parser.parse(xmlContent);
    if (!parsed || typeof parsed !== 'object')
        return null;
    const isShow = Boolean(parsed.tvshow);
    const isEpisode = Boolean(parsed.episodedetails);
    const isSeason = Boolean(parsed.season);
    const isSet = Boolean(parsed.set || parsed.collection);
    const root = parsed.movie || parsed.tvshow || parsed.episodedetails || parsed.season || parsed.set || parsed.collection;
    if (!root || (typeof root !== 'string' && Object.keys(root).length === 0))
        return null;
    const actors = (root.actor || []).map((a) => ({
        name: typeof a === 'string' ? a : a.name || 'Inconnu',
        role: typeof a === 'object' ? a.role : undefined,
        thumb: typeof a === 'object' ? a.thumb : undefined,
    }));
    const standardKeys = new Set([
        'title', 'originaltitle', 'sorttitle', 'tagline', 'plot', 'outline',
        'year', 'premiered', 'runtime', 'rating', 'genre', 'tag', 'studio',
        'country', 'director', 'credits', 'writer', 'actor', 'fileinfo', 'set',
        'season', 'episode', 'showtitle', 'seasonnumber'
    ]);
    const customFields = {};
    for (const [k, v] of Object.entries(root)) {
        if (!standardKeys.has(k.toLowerCase()) && !k.startsWith('@_')) {
            customFields[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        }
    }
    const rawTitle = root.title || '';
    const originalTitle = root.originaltitle;
    const showTitle = root.showtitle;
    const season = root.season ?? root.seasonnumber ? parseInt(root.season ?? root.seasonnumber, 10) : undefined;
    const episode = root.episode ? parseInt(root.episode, 10) : undefined;
    const cleanedTitle = cleanMediaTitle(rawTitle, originalTitle, showTitle, season, episode);
    const nodeType = isShow ? 'SHOW' : isEpisode ? 'EPISODE' : isSeason ? 'SEASON' : isSet ? 'COLLECTION' : 'MOVIE';
    return {
        type: nodeType,
        title: cleanedTitle || rawTitle || 'Média sans titre',
        originalTitle,
        sortTitle: root.sorttitle || cleanedTitle,
        showTitle,
        seasonNumber: season,
        episodeNumber: episode,
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
