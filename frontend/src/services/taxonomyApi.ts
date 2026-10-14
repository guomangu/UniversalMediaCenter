import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

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

export async function fetchTaxonomy(): Promise<TaxonomyCategory[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/ui/taxonomy`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.categories || [];
  } catch {
    return [];
  }
}

export async function fetchTaxonomyMedias(params: {
  category: string;
  tag: string;
  filter?: string;
  q?: string;
  limit?: number;
  excludeIds?: string[];
}): Promise<TaxonomyMediasResult> {
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
    return {
      items: data.items || [],
      hasMore: !!data.hasMore,
      totalReturned: data.totalReturned || 0,
    };
  } catch {
    return { items: [], hasMore: false, totalReturned: 0 };
  }
}
