import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getCurrentUser } from './authStore';
import { fetchWithCache, getCachedData } from './pwaDataCache';
import { prefetchImages } from './pwaImageCache';
import { resolveImageUrl } from './api';

export const TAXONOMY_CACHE_VERSION = 'v9';

export function getCategoriesCacheKey(): string {
  const user = getCurrentUser();
  const userKey = user ? `${user.id}_${user.isAdmin ? 'admin' : (user as any).profileRole || 'user'}` : 'anon';
  return `taxonomy_categories_${TAXONOMY_CACHE_VERSION}_${userKey}`;
}

export function clearTaxonomyCache(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('ums_cache_tax') ||
            k.startsWith('ums_cache_taxonomy') ||
            k.startsWith('tax_') ||
            k.includes('taxonomy'))
        ) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
  }
}

// Purge immédiate et transparente des anciens caches de taxonomie obsolètes au démarrage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('ums_cache_taxonomy_categories') || k.startsWith('ums_cache_tax_')) &&
        !k.includes(TAXONOMY_CACHE_VERSION)
      ) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
}

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

export const DEFAULT_TAXONOMY_CATEGORIES: TaxonomyCategory[] = [];

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
  videoQuality?: string | null;
}

export interface TaxonomyMediasResult {
  items: MediaTileItem[];
  hasMore: boolean;
  totalReturned: number;
}

export async function fetchTaxonomy(
  forceRefresh = false,
  onFresh?: (categories: TaxonomyCategory[]) => void
): Promise<TaxonomyCategory[]> {
  const cacheKey = getCategoriesCacheKey();
  const cached = getCachedData<TaxonomyCategory[]>(cacheKey);
  const needsRefresh = forceRefresh || !cached || cached.length === 0;

  return fetchWithCache<TaxonomyCategory[]>(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/ui/taxonomy`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return cached || [];
        const data = await res.json();
        const validCats = (data.categories || []).filter(
          (c: TaxonomyCategory) => c.tags && c.tags.length > 0 && c.tags.some((t) => Number(t.count) > 0)
        );
        return validCats.length > 0
          ? validCats
          : (cached || []);
      } catch {
        return cached || [];
      }
    },
    { forceRefresh: needsRefresh, staleTime: 1000 * 60 * 5, onFreshData: onFresh }
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
  const user = getCurrentUser();
  const userKey = user ? `${user.id}_${user.isAdmin ? 'admin' : (user as any).profileRole || 'user'}` : 'anon';
  const excludeKey = (params.excludeIds || []).slice().sort().join(',');
  return `tax_${TAXONOMY_CACHE_VERSION}_${userKey}_${params.category}_${params.tag}_${params.filter || ''}_${params.q || ''}_${params.limit || 15}_${excludeKey}`;
}

export function getCachedTaxonomyMedias(params: {
  category: string;
  tag: string;
  filter?: string;
  q?: string;
  limit?: number;
  excludeIds?: string[];
}): TaxonomyMediasResult | undefined {
  const exactKey = buildTaxonomyCacheKey(params);
  const exactRes = getCachedData<TaxonomyMediasResult>(exactKey);
  if (exactRes) return exactRes;

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

        if (!params.excludeIds || params.excludeIds.length === 0) {
          const baseKey = buildTaxonomyCacheKey({ ...params, excludeIds: [] });
          require('./pwaDataCache').setCachedData(baseKey, result);
        }

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
