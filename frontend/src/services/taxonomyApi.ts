import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';
import { fetchWithCache, getCachedData } from './pwaDataCache';
import { prefetchImages } from './pwaImageCache';
import { resolveImageUrl } from './api';

export interface TaxonomyTag {
  label: string;
  slug: string;
  count: number;
}

export interface TaxonomyCategory {
  id: string;
  title: string;
  tags: TaxonomyTag[];
}

export const DEFAULT_TAXONOMY_CATEGORIES: TaxonomyCategory[] = [
  {
    id: 'sagas',
    title: 'Sagas',
    tags: [
      {
        label: 'The Pixar-Disney Animations - Saga',
        slug: 'the-pixar-disney-animations-saga-collection-8354',
        count: 28,
      },
      {
        label: 'Pixar Short Films Collection',
        slug: 'pixar-short-films-collection',
        count: 13,
      },
      {
        label: 'Pirates des Caraïbes - Saga',
        slug: 'pirates-des-caraibes-saga-collection-4042',
        count: 5,
      },
      {
        label: 'Rocky - Saga',
        slug: 'rocky-saga-collection-8016',
        count: 5,
      },
    ],
  },
  {
    id: 'series',
    title: 'Séries',
    tags: [
      { label: 'Animation', slug: 'animation', count: 25 },
      { label: 'Comédie', slug: 'comedie', count: 20 },
      { label: 'Science-Fiction & Fantastique', slug: 'science-fiction-fantastique', count: 18 },
      { label: 'Action & Adventure', slug: 'action-adventure', count: 17 },
    ],
  },
  {
    id: 'movies',
    title: 'Films',
    tags: [
      { label: 'Drame', slug: 'drame', count: 105 },
      { label: 'Action', slug: 'action', count: 103 },
      { label: 'Comédie', slug: 'comedie', count: 92 },
      { label: 'Aventure', slug: 'aventure', count: 87 },
    ],
  },
  {
    id: 'studios',
    title: 'Studios',
    tags: [
      { label: 'Warner Bros. Pictures', slug: 'warner-bros-pictures', count: 16 },
      { label: 'Columbia Pictures', slug: 'columbia-pictures', count: 15 },
      { label: 'Universal Pictures', slug: 'universal-pictures', count: 13 },
      { label: '20th Century Fox', slug: '20th-century-fox', count: 12 },
    ],
  },
  {
    id: 'directors',
    title: 'Réalisateur',
    tags: [
      { label: 'Tom Harper', slug: 'tom-harper', count: 6 },
      { label: 'David Katzenberg', slug: 'david-katzenberg', count: 2 },
      { label: 'Jérémie Galan', slug: 'jeremie-galan', count: 2 },
      { label: 'Jon Favreau', slug: 'jon-favreau', count: 2 },
    ],
  },
  {
    id: 'qualities',
    title: 'Qualité',
    tags: [
      { label: '1080p', slug: '1080p', count: 274 },
      { label: '720p', slug: '720p', count: 170 },
    ],
  },
  {
    id: 'countries',
    title: 'Pays',
    tags: [
      { label: 'États-Unis', slug: 'etats-unis', count: 163 },
      { label: 'Royaume-Uni', slug: 'royaume-uni', count: 41 },
      { label: 'France', slug: 'france', count: 41 },
      { label: 'Japon', slug: 'japon', count: 20 },
    ],
  },
];

export interface MediaTileItem {
  id: string;
  title: string;
  nodeType: string;
  releaseYear?: number;
  posterPath?: string;
  communityRating?: number;
  displayBadge?: string | null;
  seasonEpisodeTag?: string | null;
  activeSessionsCount?: number;
  activeViewersCount?: number;
}

export interface TaxonomyMediasResult {
  items: MediaTileItem[];
  hasMore: boolean;
  totalReturned: number;
}

export async function fetchTaxonomy(forceRefresh = false): Promise<TaxonomyCategory[]> {
  const cached = getCachedData<TaxonomyCategory[]>('taxonomy_categories');
  return fetchWithCache<TaxonomyCategory[]>(
    'taxonomy_categories',
    async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/ui/taxonomy`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return cached || DEFAULT_TAXONOMY_CATEGORIES;
        const data = await res.json();
        return data.categories && data.categories.length > 0
          ? data.categories
          : cached || DEFAULT_TAXONOMY_CATEGORIES;
      } catch {
        return cached || DEFAULT_TAXONOMY_CATEGORIES;
      }
    },
    { forceRefresh, staleTime: 1000 * 60 * 5 }
  );
}

export function buildTaxonomyCacheKey(params: {
  category: string;
  tag: string;
  filter?: string;
  q?: string;
  limit?: number;
  excludeIds?: string[];
}): string {
  const excludeKey = (params.excludeIds || []).slice().sort().join(',');
  return `tax_${params.category}_${params.tag}_${params.filter || ''}_${params.q || ''}_${params.limit || 15}_${excludeKey}`;
}

export function getCachedTaxonomyMedias(params: {
  category: string;
  tag: string;
  filter?: string;
  q?: string;
  limit?: number;
  excludeIds?: string[];
}): TaxonomyMediasResult | undefined {
  // 1. Recherche exacte avec les exclusions actuelles
  const exactKey = buildTaxonomyCacheKey(params);
  const exactRes = getCachedData<TaxonomyMediasResult>(exactKey);
  if (exactRes) return exactRes;

  // 2. Fallback immédiat (0ms) : filtrer localement depuis le cache de base du tag
  if (params.excludeIds && params.excludeIds.length > 0) {
    const baseKey = buildTaxonomyCacheKey({ ...params, excludeIds: [] });
    const baseRes = getCachedData<TaxonomyMediasResult>(baseKey);
    if (baseRes) {
      const excludeSet = new Set(params.excludeIds);
      const filteredItems = baseRes.items.filter((m) => !excludeSet.has(m.id));
      return {
        items: filteredItems,
        hasMore: baseRes.hasMore,
        totalReturned: filteredItems.length,
      };
    }
  }

  return undefined;
}

export async function fetchTaxonomyMedias(
  params: {
    category: string;
    tag: string;
    filter?: string;
    q?: string;
    limit?: number;
    excludeIds?: string[];
  },
  forceRefresh = false
): Promise<TaxonomyMediasResult> {
  const cacheKey = buildTaxonomyCacheKey(params);

  return fetchWithCache<TaxonomyMediasResult>(
    cacheKey,
    async () => {
      try {
        const p: Record<string, string> = {
          category: params.category,
          tag: params.tag,
          filter: params.filter || '',
          q: params.q || '',
          limit: String(params.limit || 15),
        };
        if (params.excludeIds && params.excludeIds.length > 0) {
          p.excludeIds = params.excludeIds.join(',');
        }
        const query = new URLSearchParams(p).toString();
        const res = await fetch(`${getApiBaseUrl()}/api/ui/taxonomy/medias?${query}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return { items: [], hasMore: false, totalReturned: 0 };
        const data = await res.json();
        const result: TaxonomyMediasResult = {
          items: data.items || [],
          hasMore: !!data.hasMore,
          totalReturned: data.totalReturned || 0,
        };

        // Si c'est une requête sans exclusion, la persister aussi comme clé de base
        if (!params.excludeIds || params.excludeIds.length === 0) {
          const baseKey = buildTaxonomyCacheKey({ ...params, excludeIds: [] });
          require('./pwaDataCache').setCachedData(baseKey, result);
        }

        // Pré-chargement PWA natif en arrière-plan des images sans bloquer
        if (result.items.length > 0) {
          const posterUrls = result.items
            .filter((it) => it.posterPath)
            .map((it) => resolveImageUrl(it.posterPath));
          prefetchImages(posterUrls).catch(() => {});
        }

        return result;
      } catch {
        return { items: [], hasMore: false, totalReturned: 0 };
      }
    },
    { forceRefresh, staleTime: 1000 * 60 * 5 }
  );
}
