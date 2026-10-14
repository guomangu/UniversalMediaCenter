export interface ExternalActor {
  name: string;
  role?: string;
  thumb?: string;
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
  genres: string[];
  tags: string[];
  studios: string[];
  countries: string[];
  directors: string[];
  writers: string[];
  producers: string[];
  composers: string[];
  actors: ExternalActor[];
}

const UA = 'UniversalMediaStack/3.0 (contact@ums.local)';
const TMDB_TOKEN =
  process.env.THEMOVIEDB_API_ACCESS_TOKEN ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjOWYzMjhhMDEwMTFiMjhmMjI0ODM3MTczOTVmYzNmYSIsIm5iZiI6MTU4MTYzMTExOS44NjgsInN1YiI6IjVlNDVjNjhmODNlZTY3MDAxMTFmMmU5NiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.CeXrQwgB3roCAVs-Z2ayLRx99VIJbym7XSpcRjGzyLA';

export function cleanShowTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*-\s*S\d+.*|\s*S\d+E\d+.*|\s*-\s*E\d+.*|\s*int[ée]grale.*|\s*E\d+$/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .trim();
}

/**
 * Récupère les métadonnées complètes d'une série TV via TMDB (avec cast, crew, certification, tags)
 */
async function fetchTmdbTvShow(tmdbIdOrTitle: string | number): Promise<ExternalMediaMetadata | null> {
  let tvId: number | null = typeof tmdbIdOrTitle === 'number' ? tmdbIdOrTitle : null;

  if (!tvId) {
    const searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(
      tmdbIdOrTitle
    )}&language=fr-FR`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    if (!searchData.results?.length) return null;
    tvId = searchData.results[0].id;
  }

  // Requête française pour le synopsis et les genres
  const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?language=fr-FR&append_to_response=aggregate_credits,content_ratings,keywords`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!detailRes.ok) return null;
  const d = await detailRes.json();

  // Requête en-US pour obtenir les noms romanisés des réalisateurs, scénaristes et acteurs (au lieu des kanjis)
  let enCrew: any[] = [];
  let enCast: any[] = [];
  try {
    const enUrl = `https://api.themoviedb.org/3/tv/${tvId}/aggregate_credits?language=en-US`;
    const enRes = await fetch(enUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (enRes.ok) {
      const enData = await enRes.json();
      enCrew = enData.crew || [];
      enCast = enData.cast || [];
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
    const jobs = (cr.jobs || []).map((j: any) => j.job || '').join(' ').toLowerCase();
    const dept = cr.department || '';
    const name = cr.name;
    if (!name) continue;

    if (dept === 'Directing' || jobs.includes('director')) {
      if (!directors.includes(name)) directors.push(name);
    }
    if (
      dept === 'Writing' ||
      jobs.includes('writer') ||
      jobs.includes('creator') ||
      jobs.includes('author') ||
      jobs.includes('comic book')
    ) {
      if (!writers.includes(name)) writers.push(name);
    }
    if (jobs.includes('music') || jobs.includes('composer')) {
      if (!composers.includes(name)) composers.push(name);
    }
    if (dept === 'Production' && jobs.includes('producer')) {
      if (!producers.includes(name)) producers.push(name);
    }
  }

  const actors: ExternalActor[] = [];
  for (const c of castSource.slice(0, 30)) {
    if (!c.name) continue;
    const role = (c.roles || []).map((r: any) => r.character).filter(Boolean).join(', ');
    const thumb = c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined;
    actors.push({ name: c.name, role: role || undefined, thumb });
  }

  // Certification / Classification CSA
  let certification: string | undefined;
  const ratings = d.content_ratings?.results || [];
  const frRating = ratings.find((r: any) => r.iso_3166_1 === 'FR');
  const usRating = ratings.find((r: any) => r.iso_3166_1 === 'US');
  if (frRating?.rating && frRating.rating !== 'NR') {
    certification = `FR-${frRating.rating}`;
  } else if (usRating?.rating) {
    certification = usRating.rating;
  }

  // Mots-clés / Sujets
  const tags: string[] = (d.keywords?.results || []).map((k: any) => k.name).filter(Boolean);

  return {
    title: d.name,
    originalTitle: d.original_name,
    overview: d.overview || undefined,
    tagline: d.tagline || undefined,
    releaseYear: d.first_air_date ? parseInt(d.first_air_date.slice(0, 4), 10) : undefined,
    premiered: d.first_air_date || undefined,
    communityRating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
    certification,
    posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/original${d.poster_path}` : undefined,
    fanartUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : undefined,
    genres: (d.genres || []).map((g: any) => g.name).filter(Boolean),
    tags,
    studios: (d.production_companies || []).map((p: any) => p.name).filter(Boolean),
    countries: d.origin_country || [],
    directors: directors.slice(0, 10),
    writers: writers.slice(0, 10),
    composers: composers.slice(0, 5),
    producers: producers.slice(0, 10),
    actors,
  };
}

/**
 * Récupère les métadonnées complètes d'un Film via TMDB
 */
async function fetchTmdbMovie(tmdbIdOrTitle: string | number): Promise<ExternalMediaMetadata | null> {
  let movieId: number | null = typeof tmdbIdOrTitle === 'number' ? tmdbIdOrTitle : null;

  if (!movieId) {
    const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(
      tmdbIdOrTitle
    )}&language=fr-FR`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    if (!searchData.results?.length) return null;
    movieId = searchData.results[0].id;
  }

  const detailUrl = `https://api.themoviedb.org/3/movie/${movieId}?language=fr-FR&append_to_response=credits,release_dates,keywords`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!detailRes.ok) return null;
  const d = await detailRes.json();

  let enCrew: any[] = [];
  let enCast: any[] = [];
  try {
    const enUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?language=en-US`;
    const enRes = await fetch(enUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (enRes.ok) {
      const enData = await enRes.json();
      enCrew = enData.crew || [];
      enCast = enData.cast || [];
    }
  } catch {
    // Silencieux si timeout
  }

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

    if (job === 'director') {
      if (!directors.includes(name)) directors.push(name);
    }
    if (dept === 'Writing' || job.includes('writer') || job.includes('screenplay')) {
      if (!writers.includes(name)) writers.push(name);
    }
    if (job.includes('music') || job.includes('composer')) {
      if (!composers.includes(name)) composers.push(name);
    }
    if (job === 'producer') {
      if (!producers.includes(name)) producers.push(name);
    }
  }

  const actors: ExternalActor[] = [];
  for (const c of castSource.slice(0, 30)) {
    if (!c.name) continue;
    const thumb = c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined;
    actors.push({ name: c.name, role: c.character || undefined, thumb });
  }

  // Certification
  let certification: string | undefined;
  const releases = d.release_dates?.results || [];
  const frRel = releases.find((r: any) => r.iso_3166_1 === 'FR');
  const usRel = releases.find((r: any) => r.iso_3166_1 === 'US');
  const frCert = frRel?.release_dates?.find((x: any) => x.certification)?.certification;
  const usCert = usRel?.release_dates?.find((x: any) => x.certification)?.certification;
  if (frCert) certification = `FR-${frCert}`;
  else if (usCert) certification = usCert;

  const tags: string[] = (d.keywords?.keywords || []).map((k: any) => k.name).filter(Boolean);

  return {
    title: d.title,
    originalTitle: d.original_title,
    overview: d.overview || undefined,
    tagline: d.tagline || undefined,
    releaseYear: d.release_date ? parseInt(d.release_date.slice(0, 4), 10) : undefined,
    premiered: d.release_date || undefined,
    communityRating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
    certification,
    posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/original${d.poster_path}` : undefined,
    fanartUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : undefined,
    genres: (d.genres || []).map((g: any) => g.name).filter(Boolean),
    tags,
    studios: (d.production_companies || []).map((p: any) => p.name).filter(Boolean),
    countries: (d.production_countries || []).map((c: any) => c.iso_3166_1).filter(Boolean),
    directors: directors.slice(0, 5),
    writers: writers.slice(0, 5),
    composers: composers.slice(0, 3),
    producers: producers.slice(0, 5),
    actors,
  };
}

export async function fetchExternalMetadata(
  title: string,
  nodeType: string,
  externalId?: { tmdb?: string | number; imdb?: string }
): Promise<ExternalMediaMetadata | null> {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle === 'Média sans titre') return null;

  try {
    // 1. Priorité absolue : TMDB (très haute complétude technique et humaine)
    if (nodeType === 'SHOW' || nodeType === 'SEASON' || nodeType === 'EPISODE') {
      const showQuery = cleanShowTitle(cleanTitle);
      const tmdbMeta = await fetchTmdbTvShow(externalId?.tmdb || showQuery);
      if (tmdbMeta) return tmdbMeta;

      // Fallback TVmaze si TMDB inaccessible
      const res = await fetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showQuery)}&embed[]=cast&embed[]=crew`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const d = await res.json();
        const castList = (d._embedded?.cast || []).map((c: any) => ({
          name: c.person?.name,
          role: c.character?.name,
          thumb: c.character?.image?.medium || c.person?.image?.medium,
        })).filter((a: any) => a.name);

        const crewList = (d._embedded?.crew || []);
        const creators = crewList.filter((cr: any) => cr.type === 'Creator').map((cr: any) => cr.person?.name).filter(Boolean);

        return {
          title: d.name,
          overview: d.summary ? d.summary.replace(/<[^>]+>/g, '').trim() : undefined,
          releaseYear: d.premiered ? parseInt(d.premiered.slice(0, 4), 10) : undefined,
          premiered: d.premiered || undefined,
          communityRating: d.rating?.average ? parseFloat(d.rating.average) : undefined,
          posterUrl: d.image?.original || d.image?.medium,
          genres: (d.genres || []).map(String),
          tags: [],
          studios: d.network?.name ? [d.network.name] : [],
          countries: d.network?.country?.code ? [d.network.country.code] : [],
          directors: [],
          writers: creators,
          composers: [],
          producers: [],
          actors: castList,
        };
      }
    } else {
      // Film / Movie
      const tmdbMeta = await fetchTmdbMovie(externalId?.tmdb || cleanTitle);
      if (tmdbMeta) return tmdbMeta;

      // Fallback Wikipedia
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        cleanTitle
      )}&limit=1&namespace=0&format=json`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(6000),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const matched = searchData[1]?.[0];
        if (matched) {
          const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(matched)}`;
          const sumRes = await fetch(sumUrl, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(6000),
          });
          if (sumRes.ok) {
            const d = await sumRes.json();
            return {
              title: d.title ? d.title.replace(/\s*\(film.*?\)/i, '').trim() : cleanTitle,
              overview: d.extract,
              tagline: d.description,
              posterUrl: d.thumbnail?.source,
              genres: [],
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
        }
      }
    }
  } catch (err) {
    console.warn(`External metadata search failed for "${cleanTitle}":`, err);
  }

  return null;
}
