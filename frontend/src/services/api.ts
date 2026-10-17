import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getAuthToken, getCurrentUser } from './authStore';
import { fetchWithCache } from './pwaDataCache';
import { prefetchImageToCache } from './pwaImageCache';

export function resolveImageUrl(uri?: string | null): string {
  if (!uri) return '';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  if (uri.startsWith('/')) return `${getApiBaseUrl()}${uri}`;
  return `${getApiBaseUrl()}/${uri}`;
}

export function getVideoStreamUrl(id: string, shareToken?: string | null): string {
  const base = `${getApiBaseUrl()}/api/media/${id}/stream`;
  const token = getAuthToken();
  const p = new URLSearchParams();
  if (shareToken) p.set('share', shareToken);
  else if (token) p.set('token', token);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export function getUserCacheKey(): string {
  const user = getCurrentUser();
  return user ? `${user.id}_${user.isAdmin ? 'admin' : (user as any).profileRole || 'user'}` : 'anon';
}

export async function fetchHomeLayout(): Promise<any> {
  const cacheKey = `home_layout_${getUserCacheKey()}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/ui/layout?page=HOME`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.rails || [];
    } catch {
      return [];
    }
  });
}

export async function fetchMediaDetail(id: string, shareToken?: string | null): Promise<any> {
  const cacheKey = `media_detail_${getUserCacheKey()}_${id}${shareToken ? `_${shareToken}` : ''}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const query = shareToken ? `?share=${encodeURIComponent(shareToken)}` : '';
      const res = await fetch(`${getApiBaseUrl()}/api/media/${id}${query}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 403) {
          return { forbidden: true, error: 'Accès non autorisé pour votre profil' };
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      // Pré-mise en cache immédiate des images principales
      if (data) {
        if (data.posterPath) prefetchImageToCache(resolveImageUrl(data.posterPath)).catch(() => {});
        if (data.fanartPath) prefetchImageToCache(resolveImageUrl(data.fanartPath)).catch(() => {});
      }

      return data;
    } catch {
      return null;
    }
  });
}

export async function fetchNextMedia(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/media/${id}/next`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.nextNode || null;
  } catch {
    return null;
  }
}

export async function fetchMediaStats(): Promise<any> {
  const cacheKey = `media_stats_${getUserCacheKey()}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/media/stats`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  });
}

export async function triggerLibraryRefresh(limit = 50): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/library/refresh`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ limit }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function searchMedia(query: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { nodes: [], tags: [], people: [] };
  }
}
export const searchCatalog = searchMedia;

export async function fetchLiveChannels(
  params?: { q?: string; category?: string; limit?: number },
  options?: { forceRefresh?: boolean; onFreshData?: (fresh: any[]) => void }
): Promise<any[]> {
  const cacheKey = `iptv_channels_${getUserCacheKey()}_${params?.q || ''}_${params?.category || ''}_${params?.limit || 0}`;
  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (params?.category && params.category !== 'ALL') sp.set('category', params.category);
        if (params?.limit) sp.set('limit', String(params.limit));
        const qs = sp.toString();
        const url = `${getApiBaseUrl()}/api/iptv/channels${qs ? `?${qs}` : ''}`;
        const res = await fetch(url, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.channels || [];
      } catch {
        return [];
      }
    },
    options
  );
}

export async function fetchIptvCategories(
  options?: { forceRefresh?: boolean; onFreshData?: (fresh: string[]) => void }
): Promise<string[]> {
  const cacheKey = `iptv_categories_${getUserCacheKey()}`;
  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/iptv/categories`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.categories || [];
      } catch {
        return [];
      }
    },
    options
  );
}

export async function saveWatchProgress(
  nodeId: string,
  userId: string,
  positionSeconds: number,
  durationSeconds: number
): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/media/${nodeId}/progress`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, positionSeconds, durationSeconds }),
    });
  } catch {}
}
