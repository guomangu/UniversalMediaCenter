export interface ExternalMediaMetadata {
  title?: string;
  overview?: string;
  tagline?: string;
  releaseYear?: number;
  communityRating?: number;
  posterUrl?: string;
  genres: string[];
}

const UA = 'UniversalMediaStack/3.0 (contact@ums.local)';

export async function fetchExternalMetadata(
  title: string,
  nodeType: string
): Promise<ExternalMediaMetadata | null> {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle === 'Média sans titre') return null;

  try {
    if (nodeType === 'SHOW' || nodeType === 'EPISODE') {
      const showQuery = cleanTitle.split(' - S')[0].replace(/\s*-\s*iNTEGRALE.*/i, '').trim();
      const res = await fetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showQuery)}`
      );
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
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const matched = searchData[1]?.[0];
      if (matched) {
        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(matched)}`;
        const sumRes = await fetch(sumUrl, { headers: { 'User-Agent': UA } });
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
  } catch (err) {
    console.warn(`External metadata search failed for "${cleanTitle}":`, err);
  }

  return null;
}
