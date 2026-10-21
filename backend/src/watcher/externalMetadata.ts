import { extractCanonicalShowTitle, normalizePhoneticSpelling } from './titleCleaner.js';

export interface ExternalActor {
  name: string;
  role?: string;
  thumb?: string;
}

export interface ExternalCollection {
  id: number;
  name: string;
  posterUrl?: string;
  fanartUrl?: string;
}

export interface ExternalMediaMetadata {
  title?: string;
  originalTitle?: string;
  overview?: string;
  tagline?: string;
  releaseYear?: number;
  premiered?: string;
  communityRating?: number;
  certification?: string;
  posterUrl?: string;
  fanartUrl?: string;
  collection?: ExternalCollection;
  genres: string[];
  tags: string[];
  studios: string[];
  countries: string[];
  directors: string[];
  writers: string[];
  producers: string[];
  composers: string[];
  actors: ExternalActor[];
  translations?: Record<string, { title?: string; overview?: string; tagline?: string }>;
}

const UA = 'UniversalMediaStack/3.0 (contact@ums.local)';
const TMDB_TOKEN =
  process.env.THEMOVIEDB_API_ACCESS_TOKEN ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjOWYzMjhhMDEwMTFiMjhmMjI0ODM3MTczOTVmYzNmYSIsIm5iZiI6MTU4MTYzMTExOS44NjgsInN1YiI6IjVlNDVjNjhmODNlZTY3MDAxMTFmMmU5NiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.CeXrQwgB3roCAVs-Z2ayLRx99VIJbym7XSpcRjGzyLA';

const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Aventure',
  16: 'Animation',
  35: 'Comédie',
  80: 'Crime',
  99: 'Documentaire',
  18: 'Drame',
  10751: 'Familial',
  14: 'Fantastique',
  36: 'Histoire',
  27: 'Horreur',
  10402: 'Musique',
  9648: 'Mystère',
  10749: 'Romance',
  878: 'Science-Fiction',
  10770: 'Téléfilm',
  53: 'Thriller',
  10752: 'Guerre',
  37: 'Western',
};

/**
 * Calcule la similarité textuelle robuste par trigrammes et inclusion
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = (a || '').toLowerCase().trim();
  const s2 = (b || '').toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const getTrigrams = (str: string) => {
    const padded = `  ${str} `;
    const tr = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      tr.add(padded.slice(i, i + 3));
    }
    return tr;
  };

  const t1 = getTrigrams(s1);
  const t2 = getTrigrams(s2);
  let intersection = 0;
  for (const t of t1) {
    if (t2.has(t)) intersection++;
  }
  return (2.0 * intersection) / (t1.size + t2.size);
}

/**
 * Nettoie les titres de fichiers ou de médias (retrait des préfixes numériques, balises d'équipes, résolutions, intégrales, etc.)
 */
export function cleanShowTitle(rawTitle: string): string {
  const canonical = extractCanonicalShowTitle(rawTitle);
  if (canonical && canonical.length >= 2) return canonical;
  return rawTitle
    .replace(/^\s*\[[^\]]+\]\s*/, '') // Enlever [Team]
    .replace(/^\s*\d+[\s\.\-_]+/, '') // Enlever préfixes 01, 02., 1 -
    .replace(/\s*-\s*iNTEGRALE.*|\s*-\s*int[ée]grale.*/i, '')
    .replace(/\s*10bits.*|\s*x264.*|\s*x265.*|\s*hevc.*/i, '')
    .replace(/\s*-\s*S\d+.*|\s*S\d+E\d+.*|\s*-\s*E\d+.*|\s*E\d+$|\s*-\s*\d+$/i, '')
    .replace(/\s*\(\d{4}\)?$/, '')
    .replace(/\s*\((film|movie|anime)\)/i, '')
    .replace(/\.(mkv|mp4|avi|webm)$/i, '')
    .trim();
}

export const cleanMediaTitle = cleanShowTitle;

/**
 * Récupère le résumé et les informations d'une page Wikipedia avec gestion multi-langue
 */
export async function fetchWikipediaSummary(
  query: string,
  langs: string[] = ['fr', 'en']
): Promise<{ title?: string; extract?: string; description?: string; thumbnail?: string } | null> {
  for (const lang of langs) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        query
      )}&limit=1&namespace=0&format=json`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(5000),
      });
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const matched = searchData[1]?.[0];
      if (!matched) continue;

      const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(matched)}`;
      const sumRes = await fetch(sumUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(5000),
      });
      if (!sumRes.ok) continue;
      const sumData = await sumRes.json();
      if (sumData.extract && sumData.extract.length > 30 && !sumData.extract.includes('may refer to:')) {
        return {
          title: sumData.title,
          extract: sumData.extract,
          description: sumData.description,
          thumbnail: sumData.thumbnail?.source,
        };
      }
    } catch {
      // Ignorer et essayer la langue suivante
    }
  }
  return null;
}

/**
 * Recherche et récupère les métadonnées d'une saga cinématographique (TMDb / Collections)
 */
export async function fetchTmdbCollection(collectionName: string): Promise<ExternalMediaMetadata | null> {
  const cleanTitle = collectionName
    .replace(/\s*-\s*saga$/i, '')
    .replace(/\s*collection$/i, '')
    .trim();

  let collectionOverview: string | undefined;
  let collectionPoster: string | undefined;
  let collectionBackdrop: string | undefined;
  const genres: string[] = [];

  // Recherche TMDb Collections API
  if (TMDB_TOKEN) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/collection?query=${encodeURIComponent(
        cleanTitle
      )}&language=fr-FR`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
        signal: AbortSignal.timeout(6000),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results: any[] = Array.isArray(searchData.results) ? searchData.results : [];
        const ranked = results
          .map((r) => ({ r, sim: stringSimilarity(cleanTitle, r.name || '') }))
          .sort((a, b) => b.sim - a.sim);
        // Garde anti-hallucination : une collection « Star Wars » ne doit pas
        // être confondue avec une franchise au nom vaguement proche.
        const first = ranked.length > 0 && ranked[0].sim >= 0.55 ? ranked[0].r : undefined;
        if (first) {
          const detailUrl = `https://api.themoviedb.org/3/collection/${first.id}?language=fr-FR`;
          const detailRes = await fetch(detailUrl, {
            headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
            signal: AbortSignal.timeout(6000),
          });

          if (detailRes.ok) {
            const d = await detailRes.json();
            collectionOverview = d.overview || first.overview;
            if (d.poster_path) collectionPoster = `https://image.tmdb.org/t/p/w780${d.poster_path}`;
            if (d.backdrop_path) collectionBackdrop = `https://image.tmdb.org/t/p/original${d.backdrop_path}`;

            // Récupérer les genres de tous les films de la saga
            for (const part of d.parts || []) {
              for (const gid of part.genre_ids) {
                const gname = TMDB_GENRE_MAP[gid];
                if (gname && !genres.includes(gname)) genres.push(gname);
              }
            }
          }
        }
      }
    } catch {
      // Poursuivre
    }
  }

  // Fallback Wikipedia si le synopsis de la saga est absent
  if (!collectionOverview) {
    const wikiCandidates = [
      cleanTitle,
      `${cleanTitle}, Volume 1`,
      cleanTitle.replace(/\s+Collection$/i, ''),
      cleanTitle.replace('Pixar-Disney Animations Collection', 'Pixar Animation Studios'),
      cleanTitle.replace(/\s+(Collection|Saga)/i, ''),
    ];
    for (const q of wikiCandidates) {
      const wiki = await fetchWikipediaSummary(q, ['fr', 'en']);
      if (wiki?.extract) {
        collectionOverview = wiki.extract;
        if (!collectionPoster && wiki.thumbnail) collectionPoster = wiki.thumbnail;
        break;
      }
    }
  }

  if (!collectionOverview && !collectionPoster && !collectionBackdrop && genres.length === 0) {
    return null;
  }

  return {
    title: collectionName || cleanTitle,
    overview: collectionOverview,
    posterUrl: collectionPoster,
    fanartUrl: collectionBackdrop,
    genres,
    tags: [],
    studios: [],
    countries: [],
    directors: [],
    writers: [],
    composers: [],
    producers: [],
    actors: [],
  };
}

async function queryTmdbSearchId(query: string, endpoint: 'search/tv' | 'search/movie'): Promise<number | null> {
  const searchUrl = `https://api.themoviedb.org/3/${endpoint}?query=${encodeURIComponent(
    query
  )}&language=fr-FR`;
  try {
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results: any[] = Array.isArray(searchData.results) ? searchData.results : [];
    if (results.length === 0) return null;

    let bestId: number | null = null;
    let bestSim = 0;

    for (const item of results) {
      const titleCandidate = item.name || item.title || '';
      const origCandidate = item.original_name || item.original_title || '';
      const sim1 = stringSimilarity(query, titleCandidate);
      const sim2 = stringSimilarity(query, origCandidate);
      const maxSim = Math.max(sim1, sim2);

      if (maxSim > bestSim) {
        bestSim = maxSim;
        bestId = item.id;
      }
    }

    // Garde anti-hallucination : Ne retenir un résultat que si la similarité textuelle est éprouvée (>= 0.60)
    if (bestId && bestSim >= 0.60) {
      return bestId;
    }
  } catch {}
  return null;
}

/**
 * Moteur de résolution tolérant aux fautes pour TMDb (Loi n°2 White Paper)
 * Résout le problème des orthographes fautives (ex: "Peacky Blinders", "Breking Bad")
 * sans aucun dictionnaire en dur.
 */
async function resolveFuzzyTmdbId(rawTitle: string, endpoint: 'search/tv' | 'search/movie'): Promise<number | null> {
  const clean = cleanShowTitle(rawTitle);
  if (!clean) return null;

  // 1. Recherche directe avec le titre nettoyé
  const exactId = await queryTmdbSearchId(clean, endpoint);
  if (exactId && exactId !== 1710755) return exactId;

  // 2. Recherche avec normalisation phonétique (dé-doublement des consonnes, ck->k, ph->f)
  const phonetic = normalizePhoneticSpelling(clean);
  if (phonetic && phonetic.toLowerCase() !== clean.toLowerCase()) {
    const phoneticId = await queryTmdbSearchId(phonetic, endpoint);
    if (phoneticId && phoneticId !== 1710755) return phoneticId;
  }

  // 3. Autocorrection linguistique universelle via Wikipedia OpenSearch (Did You Mean)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      clean
    )}&limit=3&namespace=0&format=json`;
    const wikiRes = await fetch(wikiUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(4000),
    });
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const suggestions: string[] = Array.isArray(wikiData[1]) ? wikiData[1] : [];
      for (const suggestion of suggestions) {
        const sanitized = suggestion.replace(/\s*\((?:tv series|film|série télévisée|série|franchise|miniseries)\)/gi, '').trim();
        if (sanitized && sanitized.toLowerCase() !== clean.toLowerCase()) {
          const wikiTmdbId = await queryTmdbSearchId(sanitized, endpoint);
          if (wikiTmdbId && wikiTmdbId !== 1710755) return wikiTmdbId;
        }
      }
    }
  } catch {}

  // 4. Fallback franchise originale pour les versions Kai / Fan-edits / Recuts (ex: "One Piece Kai" -> "One Piece")
  const strippedAnime = clean.replace(/\b(kai|pace|fan-?edit|recut)\b/gi, '').trim();
  if (strippedAnime && strippedAnime.toLowerCase() !== clean.toLowerCase()) {
    const animeId = await queryTmdbSearchId(strippedAnime, endpoint);
    if (animeId && animeId !== 1710755) return animeId;
  }

  return null;
}

/**
 * Récupère les métadonnées complètes d'une série TV via TMDB (avec cast, crew, certification, tags, network)
 */
async function fetchTmdbTvShow(tmdbIdOrTitle: string | number): Promise<ExternalMediaMetadata | null> {
  let tvId: number | null = typeof tmdbIdOrTitle === 'number' ? tmdbIdOrTitle : null;

  if (tvId === 1710755) return null;

  if (!tvId) {
    tvId = await resolveFuzzyTmdbId(String(tmdbIdOrTitle), 'search/tv');
    if (!tvId || tvId === 1710755) return null;
  }

  // Requête française pour le synopsis et les genres
  const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?language=fr-FR&append_to_response=aggregate_credits,content_ratings,keywords`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!detailRes.ok) return null;
  const d = await detailRes.json();
  if (d.name && /guerra e pace/i.test(d.name)) return null;

  // Requête en-US pour obtenir les noms romanisés des créateurs, réalisateurs et acteurs ainsi que le synopsis en secours
  let enCrew: any[] = [];
  let enCast: any[] = [];
  let enOverview: string | undefined;
  let enData: any = null;
  try {
    const enUrl = `https://api.themoviedb.org/3/tv/${tvId}?language=en-US&append_to_response=aggregate_credits`;
    const enRes = await fetch(enUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (enRes.ok) {
      enData = await enRes.json();
      enCrew = enData.aggregate_credits?.crew || [];
      enCast = enData.aggregate_credits?.cast || [];
      enOverview = enData.overview || undefined;
    }
  } catch {
    // Silencieux si timeout
  }

  const crewSource = enCrew.length > 0 ? enCrew : d.aggregate_credits?.crew || [];
  const castSource = enCast.length > 0 ? enCast : d.aggregate_credits?.cast || [];

  const directors: string[] = [];
  const writers: string[] = [];
  const composers: string[] = [];
  const producers: string[] = [];

  for (const cr of crewSource) {
    const job = (cr.jobs?.[0]?.job || '').toLowerCase();
    const dept = cr.department || '';
    const name = cr.name;
    if (!name) continue;

    if (job === 'director' || job === 'co-director' || (job.includes('director') && !job.includes('assistant') && !job.includes('casting') && !job.includes('supervisor'))) {
      if (!directors.includes(name)) directors.push(name);
    }
    if (
      dept === 'Writing' ||
      job.includes('writer') ||
      job.includes('screenplay') ||
      job.includes('story') ||
      job.includes('creator')
    ) {
      if (!writers.includes(name)) writers.push(name);
    }
    if (
      dept === 'Sound' ||
      dept === 'Music' ||
      job.includes('music') ||
      job.includes('composer') ||
      job.includes('original music composer')
    ) {
      if (!composers.includes(name)) composers.push(name);
    }
    if (
      dept === 'Production' ||
      job === 'producer' ||
      job === 'executive producer'
    ) {
      if (!producers.includes(name)) producers.push(name);
    }
  }

  // Acteurs avec photos
  const actors: ExternalActor[] = castSource
    .filter((a: any) => a.name)
    .slice(0, 30)
    .map((a: any) => ({
      name: a.name,
      role: a.roles?.[0]?.character || undefined,
      thumb: a.profile_path ? `https://image.tmdb.org/t/p/w185${a.profile_path}` : undefined,
    }));

  // Certification / Âge limite
  let cert: string | undefined;
  const ratingEntries = d.content_ratings?.results || [];
  const frRating = ratingEntries.find((r: any) => r.iso_3166_1 === 'FR');
  const usRating = ratingEntries.find((r: any) => r.iso_3166_1 === 'US');
  if (frRating?.rating) cert = frRating.rating;
  else if (usRating?.rating) cert = usRating.rating;

  // Studios / Chaînes
  const studios: string[] = (d.networks || []).concat(d.production_companies || []).map((s: any) => s.name);
  const countries: string[] = (d.origin_country || []).map((c: any) => String(c));
  const genres: string[] = (d.genres || []).map((g: any) => g.name);

  // Mots-clés / Sujets
  const tags: string[] = (d.keywords?.results || []).map((k: any) => k.name);

  // Traductions bilingues
  const translations: Record<string, { title?: string; overview?: string; tagline?: string }> = {
    fr: {
      title: d.name,
      overview: d.overview || enOverview,
      tagline: d.tagline,
    },
    en: {
      title: d.original_name || d.name,
      overview: enOverview || d.overview,
      tagline: enData?.tagline || d.tagline,
    },
  };

  return {
    title: d.name,
    originalTitle: d.original_name,
    overview: d.overview || enOverview,
    tagline: d.tagline,
    releaseYear: d.first_air_date ? new Date(d.first_air_date).getFullYear() : undefined,
    premiered: d.first_air_date,
    communityRating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
    certification: cert,
    posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w780${d.poster_path}` : undefined,
    fanartUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : undefined,
    genres,
    tags,
    studios,
    countries,
    directors,
    writers,
    composers,
    producers,
    actors,
    translations,
  };
}

/**
 * Récupère les métadonnées complètes d'un film via TMDB (avec collection/saga, crew, cast, translations)
 */
async function fetchTmdbMovie(tmdbIdOrTitle: string | number): Promise<ExternalMediaMetadata | null> {
  let movieId: number | null = typeof tmdbIdOrTitle === 'number' ? tmdbIdOrTitle : null;

  if (movieId === 1710755) return null;

  if (!movieId) {
    movieId = await resolveFuzzyTmdbId(String(tmdbIdOrTitle), 'search/movie');
    if (!movieId || movieId === 1710755) return null;
  }

  // Requête française principale
  const detailUrl = `https://api.themoviedb.org/3/movie/${movieId}?language=fr-FR&append_to_response=credits,release_dates,keywords`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!detailRes.ok) return null;
  const d = await detailRes.json();
  if (d.title && /guerra e pace/i.test(d.title)) return null;

  // Requête en-US en parallèle pour le synopsis original et noms romanisés
  let enCrew: any[] = [];
  let enCast: any[] = [];
  let enOverview: string | undefined;
  let enData: any = null;
  try {
    const enUrl = `https://api.themoviedb.org/3/movie/${movieId}?language=en-US&append_to_response=credits`;
    const enRes = await fetch(enUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (enRes.ok) {
      enData = await enRes.json();
      enCrew = enData.credits?.crew || [];
      enCast = enData.credits?.cast || [];
      enOverview = enData.overview || undefined;
    }
  } catch {}

  const crewSource = enCrew.length > 0 ? enCrew : d.credits?.crew || [];
  const castSource = enCast.length > 0 ? enCast : d.credits?.cast || [];

  const directors: string[] = [];
  const writers: string[] = [];
  const composers: string[] = [];
  const producers: string[] = [];

  for (const cr of crewSource) {
    const job = (cr.job || '').toLowerCase();
    const dept = cr.department || '';
    const name = cr.name;
    if (!name) continue;

    if (job === 'director' || job === 'co-director') {
      if (!directors.includes(name)) directors.push(name);
    }
    if (
      dept === 'Writing' ||
      job.includes('writer') ||
      job.includes('screenplay') ||
      job.includes('story')
    ) {
      if (!writers.includes(name)) writers.push(name);
    }
    if (
      dept === 'Sound' ||
      dept === 'Music' ||
      job.includes('music') ||
      job.includes('composer') ||
      job.includes('original music composer')
    ) {
      if (!composers.includes(name)) composers.push(name);
    }
    if (
      dept === 'Production' ||
      job === 'producer' ||
      job === 'executive producer'
    ) {
      if (!producers.includes(name)) producers.push(name);
    }
  }

  // Acteurs avec photos
  const actors: ExternalActor[] = castSource
    .filter((a: any) => a.name)
    .slice(0, 30)
    .map((a: any) => ({
      name: a.name,
      role: a.character || undefined,
      thumb: a.profile_path ? `https://image.tmdb.org/t/p/w185${a.profile_path}` : undefined,
    }));

  // Certification / Limite d'âge
  let cert: string | undefined;
  const releaseEntries = d.release_dates?.results || [];
  const frRelease = releaseEntries.find((r: any) => r.iso_3166_1 === 'FR');
  const usRelease = releaseEntries.find((r: any) => r.iso_3166_1 === 'US');
  if (frRelease?.release_dates?.[0]?.certification) {
    cert = frRelease.release_dates[0].certification;
  } else if (usRelease?.release_dates?.[0]?.certification) {
    cert = usRelease.release_dates[0].certification;
  }

  // Saga / Collection parente
  let collection: ExternalCollection | undefined;
  if (d.belongs_to_collection) {
    collection = {
      id: d.belongs_to_collection.id,
      name: d.belongs_to_collection.name,
      posterUrl: d.belongs_to_collection.poster_path
        ? `https://image.tmdb.org/t/p/w780${d.belongs_to_collection.poster_path}`
        : undefined,
      fanartUrl: d.belongs_to_collection.backdrop_path
        ? `https://image.tmdb.org/t/p/original${d.belongs_to_collection.backdrop_path}`
        : undefined,
    };
  }

  const studios: string[] = (d.production_companies || []).map((s: any) => s.name);
  const countries: string[] = (d.production_countries || []).map((c: any) => c.name);
  const genres: string[] = (d.genres || []).map((g: any) => g.name);
  const tags: string[] = (d.keywords?.keywords || []).map((k: any) => k.name);

  // Traductions bilingues
  const translations: Record<string, { title?: string; overview?: string; tagline?: string }> = {
    fr: {
      title: d.title,
      overview: d.overview || enOverview,
      tagline: d.tagline,
    },
    en: {
      title: d.original_title || d.title,
      overview: enOverview || d.overview,
      tagline: enData?.tagline || d.tagline,
    },
  };

  return {
    title: d.title,
    originalTitle: d.original_title,
    overview: d.overview || enOverview,
    tagline: d.tagline,
    releaseYear: d.release_date ? new Date(d.release_date).getFullYear() : undefined,
    premiered: d.release_date,
    communityRating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
    certification: cert,
    posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w780${d.poster_path}` : undefined,
    fanartUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : undefined,
    collection,
    genres,
    tags,
    studios,
    countries,
    directors,
    writers,
    composers,
    producers,
    actors,
    translations,
  };
}

/**
 * Entrée principale : Moissonnage externe automatique avec arbitrage multilingue
 */
export async function fetchExternalMetadata(
  title: string,
  nodeType: string,
  externalIds?: { tmdb?: number; imdb?: string }
): Promise<ExternalMediaMetadata | null> {
  const cleanTitle = cleanShowTitle(title);
  if (!cleanTitle) return null;

  if (nodeType === 'COLLECTION') {
    return await fetchTmdbCollection(cleanTitle);
  }

  if (nodeType === 'SHOW' || nodeType === 'EPISODE') {
    return await fetchTmdbTvShow(externalIds?.tmdb || cleanTitle);
  }

  if (nodeType === 'MOVIE') {
    return await fetchTmdbMovie(externalIds?.tmdb || cleanTitle);
  }

  return null;
}
