const UA = 'UniversalMediaStack/3.0 (contact@ums.local)';
const TMDB_TOKEN = process.env.THEMOVIEDB_API_ACCESS_TOKEN ||
    'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjOWYzMjhhMDEwMTFiMjhmMjI0ODM3MTczOTVmYzNmYSIsIm5iZiI6MTU4MTYzMTExOS44NjgsInN1YiI6IjVlNDVjNjhmODNlZTY3MDAxMTFmMmU5NiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.CeXrQwgB3roCAVs-Z2ayLRx99VIJbym7XSpcRjGzyLA';
const TMDB_GENRE_MAP = {
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
 * Nettoie les titres de fichiers ou de médias (retrait des préfixes numériques, balises d'équipes, résolutions, intégrales, etc.)
 */
export function cleanShowTitle(rawTitle) {
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
export async function fetchWikipediaSummary(query, langs = ['fr', 'en']) {
    for (const lang of langs) {
        try {
            const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`;
            const searchRes = await fetch(searchUrl, {
                headers: { 'User-Agent': UA },
                signal: AbortSignal.timeout(5000),
            });
            if (!searchRes.ok)
                continue;
            const searchData = await searchRes.json();
            const matched = searchData[1]?.[0];
            if (!matched)
                continue;
            const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(matched)}`;
            const sumRes = await fetch(sumUrl, {
                headers: { 'User-Agent': UA },
                signal: AbortSignal.timeout(5000),
            });
            if (!sumRes.ok)
                continue;
            const sumData = await sumRes.json();
            if (sumData.extract && sumData.extract.length > 30 && !sumData.extract.includes('may refer to:')) {
                return {
                    title: sumData.title,
                    extract: sumData.extract,
                    description: sumData.description,
                    thumbnail: sumData.thumbnail?.source,
                };
            }
        }
        catch {
            // Ignorer et essayer la langue suivante
        }
    }
    return null;
}
/**
 * Récupère les métadonnées complètes d'une Saga / Collection via TMDB avec fallback Wikipedia
 */
async function fetchTmdbCollection(rawTitle) {
    const cleanTitle = rawTitle.trim();
    const candidates = [
        cleanTitle,
        cleanTitle.replace(/\s+(Collection|Saga|Trilogy|Tetralogy|Série|Series)/i, ''),
        cleanTitle.replace(/^(The\s+Ultimate|The\s+Complete|The)\s+/i, ''),
        cleanTitle
            .replace(/^(The\s+Ultimate|The\s+Complete|The)\s+/i, '')
            .replace(/\s+(Collection|Saga|Trilogy|Tetralogy)/i, ''),
    ];
    const uniqueCandidates = [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];
    let collectionId = null;
    let collectionOverview;
    let collectionPoster;
    let collectionBackdrop;
    let collectionName;
    for (const cand of uniqueCandidates) {
        try {
            const searchUrl = `https://api.themoviedb.org/3/search/collection?query=${encodeURIComponent(cand)}&language=fr-FR`;
            const searchRes = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
                signal: AbortSignal.timeout(6000),
            });
            if (!searchRes.ok)
                continue;
            const searchData = await searchRes.json();
            if (searchData.results && searchData.results.length > 0) {
                const best = searchData.results.find((r) => r.overview && r.overview.length > 0) ||
                    searchData.results[0];
                collectionId = best.id;
                collectionName = best.name;
                collectionOverview = best.overview || undefined;
                collectionPoster = best.poster_path
                    ? `https://image.tmdb.org/t/p/original${best.poster_path}`
                    : undefined;
                collectionBackdrop = best.backdrop_path
                    ? `https://image.tmdb.org/t/p/original${best.backdrop_path}`
                    : undefined;
                break;
            }
        }
        catch {
            // Continuer avec le candidat suivant
        }
    }
    const genres = [];
    if (collectionId) {
        try {
            const detailUrl = `https://api.themoviedb.org/3/collection/${collectionId}?language=fr-FR`;
            const detailRes = await fetch(detailUrl, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
                signal: AbortSignal.timeout(6000),
            });
            if (detailRes.ok) {
                const d = await detailRes.json();
                if (d.overview && d.overview.length > 0) {
                    collectionOverview = d.overview;
                }
                if (d.name)
                    collectionName = d.name;
                if (d.poster_path)
                    collectionPoster = `https://image.tmdb.org/t/p/original${d.poster_path}`;
                if (d.backdrop_path)
                    collectionBackdrop = `https://image.tmdb.org/t/p/original${d.backdrop_path}`;
                if (Array.isArray(d.parts)) {
                    for (const part of d.parts) {
                        if (Array.isArray(part.genre_ids)) {
                            for (const gid of part.genre_ids) {
                                const gname = TMDB_GENRE_MAP[gid];
                                if (gname && !genres.includes(gname))
                                    genres.push(gname);
                            }
                        }
                    }
                }
            }
        }
        catch {
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
                if (!collectionPoster && wiki.thumbnail)
                    collectionPoster = wiki.thumbnail;
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
/**
 * Récupère les métadonnées complètes d'une série TV via TMDB (avec cast, crew, certification, tags, network)
 */
async function fetchTmdbTvShow(tmdbIdOrTitle) {
    let tvId = typeof tmdbIdOrTitle === 'number' ? tmdbIdOrTitle : null;
    if (!tvId) {
        const searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(tmdbIdOrTitle)}&language=fr-FR`;
        const searchRes = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
            signal: AbortSignal.timeout(6000),
        });
        if (!searchRes.ok)
            return null;
        const searchData = await searchRes.json();
        if (!searchData.results?.length)
            return null;
        tvId = searchData.results[0].id;
    }
    // Requête française pour le synopsis et les genres
    const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?language=fr-FR&append_to_response=aggregate_credits,content_ratings,keywords`;
    const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
    });
    if (!detailRes.ok)
        return null;
    const d = await detailRes.json();
    // Requête en-US pour obtenir les noms romanisés des créateurs, réalisateurs et acteurs ainsi que le synopsis en secours
    let enCrew = [];
    let enCast = [];
    let enOverview;
    let enData = null;
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
    }
    catch {
        // Silencieux si timeout
    }
    const crewSource = enCrew.length > 0 ? enCrew : d.aggregate_credits?.crew || [];
    const castSource = enCast.length > 0 ? enCast : d.aggregate_credits?.cast || [];
    const directors = [];
    const writers = [];
    const composers = [];
    const producers = [];
    for (const cr of crewSource) {
        const jobs = (cr.jobs || []).map((j) => j.job || '').join(' ').toLowerCase();
        const dept = cr.department || '';
        const name = cr.name;
        if (!name)
            continue;
        if (dept === 'Directing' || jobs.includes('director')) {
            if (!directors.includes(name))
                directors.push(name);
        }
        if (dept === 'Writing' ||
            jobs.includes('writer') ||
            jobs.includes('creator') ||
            jobs.includes('author') ||
            jobs.includes('comic book')) {
            if (!writers.includes(name))
                writers.push(name);
        }
        if (jobs.includes('music') || jobs.includes('composer')) {
            if (!composers.includes(name))
                composers.push(name);
        }
        if (dept === 'Production' && jobs.includes('producer')) {
            if (!producers.includes(name))
                producers.push(name);
        }
    }
    const actors = [];
    for (const c of castSource.slice(0, 30)) {
        if (!c.name)
            continue;
        const role = (c.roles || []).map((r) => r.character).filter(Boolean).join(', ');
        const thumb = c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined;
        actors.push({ name: c.name, role: role || undefined, thumb });
    }
    // Certification / Classification CSA
    let certification;
    const ratings = d.content_ratings?.results || [];
    const frRating = ratings.find((r) => r.iso_3166_1 === 'FR');
    const usRating = ratings.find((r) => r.iso_3166_1 === 'US');
    if (frRating?.rating && frRating.rating !== 'NR') {
        certification = `FR-${frRating.rating}`;
    }
    else if (usRating?.rating) {
        certification = usRating.rating;
    }
    // Mots-clés / Sujets
    const tags = (d.keywords?.results || []).map((k) => k.name).filter(Boolean);
    // Studios et diffuseurs/networks
    const studioSet = new Set();
    for (const p of d.production_companies || []) {
        if (p.name)
            studioSet.add(p.name);
    }
    for (const n of d.networks || []) {
        if (n.name)
            studioSet.add(n.name);
    }
    // Synopsis résilient (FR -> Wikipédia FR -> EN -> Wikipédia EN)
    let finalOverview = d.overview || undefined;
    if (!finalOverview || finalOverview.trim().length === 0) {
        const wikiFr = await fetchWikipediaSummary(d.name || String(tmdbIdOrTitle), ['fr']);
        if (wikiFr?.extract) {
            finalOverview = wikiFr.extract;
        }
        else if (enOverview && enOverview.trim().length > 0) {
            finalOverview = enOverview;
        }
        else {
            const wikiEn = await fetchWikipediaSummary(d.name || String(tmdbIdOrTitle), ['en']);
            if (wikiEn?.extract)
                finalOverview = wikiEn.extract;
        }
    }
    const translations = {
        fr: {
            title: d.name || undefined,
            overview: d.overview || finalOverview,
            tagline: d.tagline || undefined,
        },
        en: {
            title: enData?.name || d.original_name || undefined,
            overview: enOverview || undefined,
            tagline: enData?.tagline || undefined,
        },
    };
    return {
        title: d.name,
        originalTitle: d.original_name,
        overview: finalOverview,
        translations,
        tagline: d.tagline || undefined,
        releaseYear: d.first_air_date ? parseInt(d.first_air_date.slice(0, 4), 10) : undefined,
        premiered: d.first_air_date || undefined,
        communityRating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
        certification,
        posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/original${d.poster_path}` : undefined,
        fanartUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : undefined,
        genres: (d.genres || []).map((g) => g.name).filter(Boolean),
        tags,
        studios: Array.from(studioSet),
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
async function fetchTmdbMovie(tmdbIdOrTitle) {
    let movieId = typeof tmdbIdOrTitle === 'number' ? tmdbIdOrTitle : null;
    if (!movieId) {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(tmdbIdOrTitle)}&language=fr-FR`;
        const searchRes = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
            signal: AbortSignal.timeout(6000),
        });
        if (!searchRes.ok)
            return null;
        const searchData = await searchRes.json();
        if (!searchData.results?.length)
            return null;
        movieId = searchData.results[0].id;
    }
    const detailUrl = `https://api.themoviedb.org/3/movie/${movieId}?language=fr-FR&append_to_response=credits,release_dates,keywords`;
    const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
    });
    if (!detailRes.ok)
        return null;
    const d = await detailRes.json();
    let enCrew = [];
    let enCast = [];
    let enOverview;
    let enData = null;
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
    }
    catch {
        // Silencieux si timeout
    }
    const crewSource = enCrew.length > 0 ? enCrew : d.credits?.crew || [];
    const castSource = enCast.length > 0 ? enCast : d.credits?.cast || [];
    const directors = [];
    const writers = [];
    const composers = [];
    const producers = [];
    for (const cr of crewSource) {
        const job = (cr.job || '').toLowerCase();
        const dept = cr.department || '';
        const name = cr.name;
        if (!name)
            continue;
        if (job === 'director') {
            if (!directors.includes(name))
                directors.push(name);
        }
        if (dept === 'Writing' || job.includes('writer') || job.includes('screenplay')) {
            if (!writers.includes(name))
                writers.push(name);
        }
        if (job.includes('music') || job.includes('composer')) {
            if (!composers.includes(name))
                composers.push(name);
        }
        if (job === 'producer') {
            if (!producers.includes(name))
                producers.push(name);
        }
    }
    const actors = [];
    for (const c of castSource.slice(0, 30)) {
        if (!c.name)
            continue;
        const thumb = c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined;
        actors.push({ name: c.name, role: c.character || undefined, thumb });
    }
    // Certification
    let certification;
    const releases = d.release_dates?.results || [];
    const frRel = releases.find((r) => r.iso_3166_1 === 'FR');
    const usRel = releases.find((r) => r.iso_3166_1 === 'US');
    const frCert = frRel?.release_dates?.find((x) => x.certification)?.certification;
    const usCert = usRel?.release_dates?.find((x) => x.certification)?.certification;
    if (frCert)
        certification = `FR-${frCert}`;
    else if (usCert)
        certification = usCert;
    const tags = (d.keywords?.keywords || []).map((k) => k.name).filter(Boolean);
    let finalOverview = d.overview || undefined;
    if (!finalOverview || finalOverview.trim().length === 0) {
        const wiki = await fetchWikipediaSummary(d.title || String(tmdbIdOrTitle), ['fr', 'en']);
        if (wiki?.extract) {
            finalOverview = wiki.extract;
        }
        else if (enOverview && enOverview.trim().length > 0) {
            finalOverview = enOverview;
        }
    }
    let collection;
    if (d.belongs_to_collection) {
        collection = {
            id: d.belongs_to_collection.id,
            name: d.belongs_to_collection.name,
            posterUrl: d.belongs_to_collection.poster_path
                ? `https://image.tmdb.org/t/p/original${d.belongs_to_collection.poster_path}`
                : undefined,
            fanartUrl: d.belongs_to_collection.backdrop_path
                ? `https://image.tmdb.org/t/p/original${d.belongs_to_collection.backdrop_path}`
                : undefined,
        };
    }
    const translations = {
        fr: {
            title: d.title || undefined,
            overview: d.overview || finalOverview,
            tagline: d.tagline || undefined,
        },
        en: {
            title: enData?.title || d.original_title || undefined,
            overview: enOverview || undefined,
            tagline: enData?.tagline || undefined,
        },
    };
    return {
        title: d.title,
        originalTitle: d.original_title,
        collection,
        overview: finalOverview,
        translations,
        tagline: d.tagline || undefined,
        releaseYear: d.release_date ? parseInt(d.release_date.slice(0, 4), 10) : undefined,
        premiered: d.release_date || undefined,
        communityRating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
        certification,
        posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/original${d.poster_path}` : undefined,
        fanartUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : undefined,
        genres: (d.genres || []).map((g) => g.name).filter(Boolean),
        tags,
        studios: (d.production_companies || []).map((p) => p.name).filter(Boolean),
        countries: (d.production_countries || []).map((c) => c.iso_3166_1).filter(Boolean),
        directors: directors.slice(0, 5),
        writers: writers.slice(0, 5),
        composers: composers.slice(0, 3),
        producers: producers.slice(0, 5),
        actors,
    };
}
export async function fetchExternalMetadata(title, nodeType, externalId) {
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle === 'Média sans titre')
        return null;
    try {
        // 1. Spécifique aux Collections / Sagas
        if (nodeType === 'COLLECTION') {
            const colMeta = await fetchTmdbCollection(cleanTitle);
            if (colMeta)
                return colMeta;
        }
        // 2. Priorité Séries TV / Saisons / Épisodes
        if (nodeType === 'SHOW' || nodeType === 'SEASON' || nodeType === 'EPISODE') {
            const showQuery = cleanShowTitle(cleanTitle);
            const tmdbMeta = await fetchTmdbTvShow(externalId?.tmdb || showQuery);
            if (tmdbMeta)
                return tmdbMeta;
            // Fallback TVmaze si TMDB inaccessible
            const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showQuery)}&embed[]=cast&embed[]=crew`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const d = await res.json();
                const castList = (d._embedded?.cast || [])
                    .map((c) => ({
                    name: c.person?.name,
                    role: c.character?.name,
                    thumb: c.character?.image?.medium || c.person?.image?.medium,
                }))
                    .filter((a) => a.name);
                const crewList = d._embedded?.crew || [];
                const creators = crewList
                    .filter((cr) => cr.type === 'Creator')
                    .map((cr) => cr.person?.name)
                    .filter(Boolean);
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
        }
        else {
            // 3. Film / Movie ou Saga en repli
            const movieQuery = cleanShowTitle(cleanTitle);
            const tmdbMeta = await fetchTmdbMovie(externalId?.tmdb || movieQuery);
            if (tmdbMeta)
                return tmdbMeta;
            // Fallback Wikipedia
            const wiki = await fetchWikipediaSummary(movieQuery, ['fr', 'en']);
            if (wiki?.extract) {
                return {
                    title: wiki.title || movieQuery,
                    overview: wiki.extract,
                    tagline: wiki.description,
                    posterUrl: wiki.thumbnail,
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
    catch (err) {
        console.warn(`External metadata search failed for "${cleanTitle}":`, err);
    }
    return null;
}
