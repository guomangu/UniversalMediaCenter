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

export function getVideoStreamUrl(id: string, shareToken?: string | null, useHls?: boolean): string {
  const base = useHls
    ? `${getApiBaseUrl()}/api/media/${id}/hls/master.m3u8`
    : `${getApiBaseUrl()}/api/media/${id}/stream`;
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

export interface EpgProgram {
  id: string;
  channelId: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  iconUrl?: string | null;
  startTime: string;
  endTime: string;
}

/**
 * Construit l'URL de téléchargement hors-ligne. Le jeton est passé en query
 * string car un lien `<a download>` ne peut pas porter d'en-tête Authorization.
 */
export function getDownloadUrl(id: string, shareToken?: string | null): string {
  const params = new URLSearchParams();
  if (shareToken) params.set('share', shareToken);
  const token = getAuthToken();
  if (token) params.set('token', token);
  const qs = params.toString();
  return `${getApiBaseUrl()}/api/media/${id}/download${qs ? `?${qs}` : ''}`;
}

/** Grille EPG d'une sélection de chaînes sur une fenêtre temporelle. */
export async function fetchEpgGuide(
  channelIds: string[],
  hours = 6,
  options?: { forceRefresh?: boolean; onFreshData?: (fresh: Record<string, EpgProgram[]>) => void }
): Promise<Record<string, EpgProgram[]>> {
  const ids = channelIds.filter(Boolean).slice(0, 200).sort();
  if (ids.length === 0) return {};
  const cacheKey = `epg_guide_v1_${getUserCacheKey()}_${hours}_${ids.join(',')}`;
  return fetchWithCache(
    cacheKey,
    async () => {
      const sp = new URLSearchParams({ channelIds: ids.join(','), hours: String(hours) });
      const res = await fetch(`${getApiBaseUrl()}/api/iptv/epg?${sp.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.programs || {};
    },
    { staleTime: 60_000, ttl: 60_000 * 30, ...options }
  );
}

/** Émission en cours et suivante pour chaque chaîne (cartes TV). */
export async function fetchEpgNowNext(
  channelIds: string[],
  options?: { forceRefresh?: boolean; onFreshData?: (fresh: Record<string, { now: EpgProgram | null; next: EpgProgram | null }>) => void }
): Promise<Record<string, { now: EpgProgram | null; next: EpgProgram | null }>> {
  const ids = channelIds.filter(Boolean).slice(0, 200).sort();
  if (ids.length === 0) return {};
  const cacheKey = `epg_nownext_v1_${getUserCacheKey()}_${ids.join(',')}`;
  return fetchWithCache(
    cacheKey,
    async () => {
      const sp = new URLSearchParams({ channelIds: ids.join(',') });
      const res = await fetch(`${getApiBaseUrl()}/api/iptv/epg/now-next?${sp.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.channels || {};
    },
    { staleTime: 60_000, ttl: 60_000 * 30, ...options }
  );
}

/** Fiche locale d'une personne (filmographie complète). */
export async function fetchPerson(slug: string): Promise<any | null> {
  const cacheKey = `person_detail_v1_${getUserCacheKey()}_${slug}`;
  return fetchWithCache(
    cacheKey,
    async () => {
      const res = await fetch(`${getApiBaseUrl()}/api/people/${encodeURIComponent(slug)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    },
    { staleTime: 5 * 60_000 }
  );
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
  const cacheKey = `iptv_channels_v3_${getUserCacheKey()}_${params?.q || ''}_${params?.category || ''}_${params?.limit || 0}`;
  return fetchWithCache(
    cacheKey,
    async () => {
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
    },
    options
  );
}

export async function fetchIptvCategories(
  options?: { forceRefresh?: boolean; onFreshData?: (fresh: string[]) => void }
): Promise<string[]> {
  const cacheKey = `iptv_categories_v2_${getUserCacheKey()}`;
  return fetchWithCache(
    cacheKey,
    async () => {
      const res = await fetch(`${getApiBaseUrl()}/api/iptv/categories`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.categories || [];
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
