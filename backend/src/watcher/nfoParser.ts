import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import type { ParsedNfo, ParsedActor, ParsedChapter, ParsedStreamDetails } from './types.js';
import {
  cleanMediaTitle,
  sanitizeReleaseTags,
  extractCanonicalShowTitle,
  extractYearFromText,
} from './titleCleaner.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    [
      'genre',
      'tag',
      'studio',
      'country',
      'director',
      'credits',
      'writer',
      'producer',
      'music',
      'composer',
      'actor',
      'video',
      'audio',
      'subtitle',
    ].includes(name),
});

export function parseNfoXml(xmlContent: string, filePath?: string): ParsedNfo | null {
  // Beaucoup de NFO de releases contiennent une bannière ASCII/ANSI avant le XML,
  // ou un BOM UTF-8. On isole le document XML avant de le parser.
  let xml = String(xmlContent || '').replace(/^\uFEFF/, '');
  if (!/^\s*</.test(xml)) {
    const rootIndex = xml.search(/<\?xml|<(movie|tvshow|episodedetails|season|set|collection)\b/i);
    if (rootIndex > 0) xml = xml.slice(rootIndex);
  }

  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const isShow = Boolean(parsed.tvshow);
  const isEpisode = Boolean(parsed.episodedetails);
  const isSeason = Boolean(parsed.season);
  const isSet = Boolean(parsed.set || parsed.collection);

  const root =
    parsed.movie ||
    parsed.tvshow ||
    parsed.episodedetails ||
    parsed.season ||
    parsed.set ||
    parsed.collection;
  if (!root || (typeof root !== 'string' && Object.keys(root).length === 0)) return null;

  // 1. Analyse contextuelle du chemin système de fichiers (dossier & nom de fichier)
  let folderSeason: number | undefined;
  let folderTitle: string | undefined;
  let filenameEpNum: number | undefined;
  let filenameEpTitle: string | undefined;
  let filenameShowTitle: string | undefined;

  if (filePath) {
    const norm = filePath.replace(/\\/g, '/');
    const parts = norm.split('/');
    const fileName = parts.pop() || '';
    const parentFolder = parts.pop() || '';

    // Détection dossier arc/saison (ex: "Peaky Blinders - Saison 4 (2017)", "Season 02", "01- Soul Society")
    const showSeasonMatch = parentFolder.match(/^(.*?)[-_\s]+(?:season|saison)\s*0*(\d{1,2})/i);
    const arcMatch = parentFolder.match(/^0*(\d{1,2})\s*[-_ ]\s*(.+)$/);
    const seasonMatch = parentFolder.match(/(?:^|[-_ ]+)(?:season|saison)\s*0*(\d{1,2})/i);

    if (showSeasonMatch) {
      folderSeason = parseInt(showSeasonMatch[2], 10);
      folderTitle = extractCanonicalShowTitle(showSeasonMatch[1]);
    } else if (arcMatch) {
      folderSeason = parseInt(arcMatch[1], 10);
      folderTitle = arcMatch[2].trim();
    } else if (seasonMatch) {
      folderSeason = parseInt(seasonMatch[1], 10);
      folderTitle = parentFolder.trim();
    } else if (/^films?$/i.test(parentFolder)) {
      folderSeason = 999;
      folderTitle = 'Films & Spéciaux';
    }

    // Détection numéro absolu et titre dans le nom de fichier
    // ex: "Bleach - 102 - Le dernier Quincy ! L`explosion du pouvoir.nfo"
    const animeEpMatch = fileName.match(/^[^-]+-\s*0*(\d{1,4})\s*-\s*(.+?)(?:\.[a-z0-9]+)?$/i);
    const sxxExxMatch = fileName.match(/(.*?)[.\s-_]*S(\d+)E(\d+)(?:[.\s-_]+(.*))?$/i);
    if (animeEpMatch) {
      filenameEpNum = parseInt(animeEpMatch[1], 10);
      filenameEpTitle = animeEpMatch[2].replace(/\.[a-z0-9]+$/i, '').trim();
    } else if (sxxExxMatch) {
      if (sxxExxMatch[1]?.trim()) {
        filenameShowTitle = extractCanonicalShowTitle(sxxExxMatch[1]);
      }
      if (!folderSeason) folderSeason = parseInt(sxxExxMatch[2], 10);
      filenameEpNum = parseInt(sxxExxMatch[3], 10);
      filenameEpTitle = (sxxExxMatch[4] || '').replace(/\.[a-z0-9]+$/i, '').replace(/[._]/g, ' ').trim();
    }
  }

  // 2. Détermination de la Saison et de l'Épisode
  let parsedSeason = root.season != null
    ? parseInt(String(root.season), 10)
    : root.seasonnumber != null
    ? parseInt(String(root.seasonnumber), 10)
    : undefined;
  if (isNaN(parsedSeason as any)) parsedSeason = undefined;

  let parsedEpisode = root.episode != null ? parseInt(String(root.episode), 10) : undefined;
  if (isNaN(parsedEpisode as any)) parsedEpisode = undefined;

  // Résolution prioritaire : si le nom de fichier porte un numéro absolu (ex: 102), il prime sur une fausse valeur relative
  let finalEpisodeNumber = parsedEpisode;
  if (filenameEpNum !== undefined) {
    if (parsedEpisode === undefined || (parsedEpisode < 100 && filenameEpNum >= 100)) {
      finalEpisodeNumber = filenameEpNum;
    }
  }

  const isFilmsFolder = folderSeason === 999 || folderTitle === 'Films & Spéciaux';
  const finalSeasonNumber = folderSeason !== undefined ? folderSeason : parsedSeason;

  // 3. Titre propre et distinct
  // Repli sur le nom de fichier quand le NFO est valide mais dépourvu de <title>.
  const fileBase = filePath
    ? path.basename(filePath, path.extname(filePath))
    : '';
  // Les NFO génériques (movie.nfo, tvshow.nfo, season.nfo) ne portent pas le
  // titre de l'œuvre : on utilise le nom du dossier parent.
  const parentFolderName = filePath ? path.basename(path.dirname(filePath)) : '';
  const isGenericNfoName = /^(movie|tvshow|season|folder|poster|fanart|backdrop|logo|clearlogo|thumb)$/i.test(fileBase);
  const titleSource = isGenericNfoName ? parentFolderName : fileBase;
  const filenameTitle = titleSource ? sanitizeReleaseTags(titleSource) : '';
  const rawTitle = root.title || filenameEpTitle || (isEpisode ? '' : filenameTitle);
  const originalTitle = root.originaltitle;
  const showTitle = root.showtitle || filenameShowTitle || folderTitle || (isShow ? filenameTitle : undefined);
  const cleanedTitle = cleanMediaTitle(
    rawTitle,
    originalTitle,
    showTitle,
    finalSeasonNumber,
    finalEpisodeNumber
  );

  // 4. Casting & Équipes (Humain & Artistique)
  const actors: ParsedActor[] = (root.actor || []).map((a: any) => ({
    name: typeof a === 'string' ? a.trim() : (a.name || 'Inconnu').trim(),
    role: typeof a === 'object' && a.role ? String(a.role).trim() : undefined,
    thumb: typeof a === 'object' && a.thumb ? String(a.thumb).trim() : undefined,
  }));

  const directors: string[] = (root.director || [])
    .map((d: any) => (typeof d === 'string' ? d.trim() : d.name ? String(d.name).trim() : ''))
    .filter(Boolean);

  const writers: string[] = [...(root.writer || []), ...(root.credits || [])]
    .map((w: any) => (typeof w === 'string' ? w.trim() : w.name ? String(w.name).trim() : ''))
    .filter(Boolean);

  const producers: string[] = (root.producer || [])
    .map((p: any) => (typeof p === 'string' ? p.trim() : p.name ? String(p.name).trim() : ''))
    .filter(Boolean);

  const composers: string[] = [...(root.composer || []), ...(root.music || [])]
    .map((m: any) => (typeof m === 'string' ? m.trim() : m.name ? String(m.name).trim() : ''))
    .filter(Boolean);

  // 5. Spécifications techniques & pistes de flux (streamdetails)
  const streamDetails: ParsedStreamDetails = { audioTracks: [], subtitleTracks: [] };
  const fileinfo = root.fileinfo;
  if (fileinfo && fileinfo.streamdetails) {
    const sd = fileinfo.streamdetails;
    const v = Array.isArray(sd.video) ? sd.video[0] : sd.video;
    if (v) {
      streamDetails.videoCodec = v.codec || v.micodec;
      streamDetails.videoWidth = v.width ? parseInt(String(v.width), 10) : undefined;
      streamDetails.videoHeight = v.height ? parseInt(String(v.height), 10) : undefined;
      streamDetails.aspectRatio = v.aspectratio || v.aspect;
      streamDetails.framerate = v.framerate;
      streamDetails.bitrate = v.bitrate ? parseInt(String(v.bitrate), 10) : undefined;
      if (v.durationinseconds) {
        streamDetails.durationSeconds = parseInt(String(v.durationinseconds), 10);
      }

      const w = streamDetails.videoWidth || 0;
      const h = streamDetails.videoHeight || 0;
      if (w > 0 || h > 0) {
        if (w >= 3800 || h >= 2000) streamDetails.videoQuality = '4K UHD';
        else if (w >= 1900 && h >= 1000) streamDetails.videoQuality = '1080p FHD';
        else if (w >= 1900 && h >= 720) streamDetails.videoQuality = '1080p Scope';
        else if (w >= 1200 || h >= 700) streamDetails.videoQuality = '720p HD';
        else if (h >= 480 || w >= 600) streamDetails.videoQuality = '480p SD';
        else streamDetails.videoQuality = 'SD';
      }
    }

    const audios = Array.isArray(sd.audio) ? sd.audio : sd.audio ? [sd.audio] : [];
    for (const a of audios) {
      streamDetails.audioTracks.push({
        codec: a.codec || a.micodec,
        language: a.language,
        channels: a.channels ? parseInt(String(a.channels), 10) : undefined,
        bitrate: a.bitrate ? parseInt(String(a.bitrate), 10) : undefined,
        samplingRate: a.samplingrate ? parseInt(String(a.samplingrate), 10) : undefined,
      });
    }

    const subs = Array.isArray(sd.subtitle) ? sd.subtitle : sd.subtitle ? [sd.subtitle] : [];
    for (const s of subs) {
      streamDetails.subtitleTracks.push({
        codec: s.codec || s.micodec,
        language: s.language,
        forced: s.forced === 'True' || s.forced === true,
      });
    }
  }

  // 6. Genres, Studios, Tags, Pays
  const genres = (root.genre || []).map((g: any) => String(g).trim()).filter(Boolean);
  const tags = (root.tag || []).map((t: any) => String(t).trim()).filter(Boolean);
  const studios = (root.studio || []).map((s: any) => String(s).trim()).filter(Boolean);
  const countries = (root.country || []).map((c: any) => String(c).trim()).filter(Boolean);

  const rawRating = root.rating != null ? parseFloat(String(root.rating)) : undefined;
  const rating = isNaN(rawRating as any) ? undefined : rawRating;

  const rawYear = root.year != null ? parseInt(String(root.year), 10) : undefined;
  const year = isNaN(rawYear as any) ? extractYearFromText(filePath || fileBase) : rawYear;

  const rawRuntime = root.runtime != null ? parseInt(String(root.runtime), 10) : undefined;
  const runtime = isNaN(rawRuntime as any) ? undefined : rawRuntime;

  const certification = root.mpaa || root.certification;

  // 7. Chapitres
  const chapters: ParsedChapter[] = [];
  if (root.chapters && Array.isArray(root.chapters.chapter)) {
    for (const ch of root.chapters.chapter) {
      chapters.push({
        title: ch.title || 'Chapitre',
        startSeconds: parseFloat(ch.start || 0),
        endSeconds: parseFloat(ch.end || 0),
      });
    }
  }

  // 8. Capture dynamique de tous les champs secondaires (Loi n°1 : Zéro perte de données)
  const standardKeys = new Set([
    'title',
    'originaltitle',
    'sorttitle',
    'plot',
    'outline',
    'year',
    'premiered',
    'releasedate',
    'runtime',
    'rating',
    'genre',
    'tag',
    'studio',
    'country',
    'director',
    'credits',
    'writer',
    'producer',
    'music',
    'composer',
    'actor',
    'fileinfo',
    'set',
    'collection',
    'season',
    'episode',
    'showtitle',
    'seasonnumber',
    'mpaa',
  ]);

  const customFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(root)) {
    if (!standardKeys.has(k.toLowerCase()) && !k.startsWith('@_')) {
      customFields[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  }

  // Détection infaillible du type de média
  // Même si le NFO porte une balise <movie> accidentelle, la présence formelle d'un épisode ou code SxxExx qualifie un EPISODE
  const hasEpisodePattern =
    isEpisode ||
    (finalEpisodeNumber !== undefined && finalEpisodeNumber > 0) ||
    Boolean(filePath && /S\d+[\s._-]*E\d+|\b\d+x\d+\b/i.test(filePath));

  const nodeType = isShow
    ? 'SHOW'
    : isSet
    ? 'COLLECTION'
    : isSeason
    ? 'SEASON'
    : isFilmsFolder && !isShow
    ? 'MOVIE'
    : hasEpisodePattern
    ? 'EPISODE'
    : 'MOVIE';

  return {
    type: nodeType,
    title: cleanedTitle || rawTitle || 'Média sans titre',
    originalTitle,
    sortTitle: root.sorttitle ? sanitizeReleaseTags(root.sorttitle) : cleanedTitle,
    showTitle,
    seasonNumber: finalSeasonNumber,
    episodeNumber: finalEpisodeNumber,
    absoluteEpisodeNumber: isFilmsFolder ? undefined : filenameEpNum,
    folderSeason,
    folderTitle,
    tagline: root.tagline,
    plot: root.plot,
    outline: root.outline,
    year,
    premiered: root.premiered || root.releasedate,
    runtime,
    rating,
    genres,
    tags,
    studios,
    countries,
    directors,
    writers,
    producers,
    composers,
    actors,
    chapters,
    streamDetails,
    certification,
    customFields,
  };
}
