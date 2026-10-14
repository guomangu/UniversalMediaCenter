const UA = 'UniversalMediaStack/3.0 (contact@ums.local)';
export function cleanShowTitle(rawTitle) {
    return rawTitle
        .replace(/\s*-\s*S\d+.*|\s*S\d+E\d+.*|\s*-\s*E\d+.*|\s*int[ée]grale.*|\s*E\d+$/i, '')
        .replace(/\s*\(.*?\)/g, '')
        .trim();
}
export async function fetchExternalMetadata(title, nodeType) {
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle === 'Média sans titre')
        return null;
    try {
        if (nodeType === 'SHOW' || nodeType === 'EPISODE' || nodeType === 'SEASON') {
            const showQuery = cleanShowTitle(cleanTitle);
            const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showQuery)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const d = await res.json();
                return {
                    title: d.name,
                    overview: d.summary ? d.summary.replace(/<[^>]+>/g, '').trim() : undefined,
                    releaseYear: d.premiered ? parseInt(d.premiered.slice(0, 4), 10) : undefined,
                    communityRating: d.rating?.average ? parseFloat(d.rating.average) : undefined,
                    posterUrl: d.image?.original || d.image?.medium,
                    genres: (d.genres || []).map(String),
                };
            }
        }
        // Recherche de films via Wikipedia Opensearch + Summary API
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanTitle)}&limit=1&namespace=0&format=json`;
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
                    };
                }
            }
        }
    }
    catch (err) {
        console.warn(`External metadata search failed for "${cleanTitle}":`, err);
    }
    return null;
}
