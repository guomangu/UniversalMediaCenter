import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export function resolveImageUrl(uri?: string | null): string {
  if (!uri) return '';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  if (uri.startsWith('/')) return `${getApiBaseUrl()}${uri}`;
  return `${getApiBaseUrl()}/${uri}`;
}

export function getVideoStreamUrl(id: string, shareToken?: string | null): string {
  const base = `${getApiBaseUrl()}/api/media/${id}/stream`;
  return shareToken ? `${base}?share=${shareToken}` : base;
}

export async function fetchHomeLayout(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/ui/layout?page=HOME`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.rails || [];
  } catch (err) {
    return [];
  }
}

export async function fetchMediaDetail(id: string, shareToken?: string | null): Promise<any> {
  try {
    const query = shareToken ? `?share=${encodeURIComponent(shareToken)}` : '';
    const res = await fetch(`${getApiBaseUrl()}/api/media/${id}${query}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    return null;
  }
}

export async function fetchNextMedia(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/media/${id}/next`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.nextNode || null;
  } catch (err) {
    return null;
  }
}

export async function fetchMediaStats(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/media/stats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
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
  } catch (err) {
    return { nodes: [], tags: [], people: [] };
  }
}
export const searchCatalog = searchMedia;

export async function fetchLiveChannels(params?: { q?: string; category?: string; limit?: number }): Promise<any[]> {
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
  } catch (err) {
    return [];
  }
}

export async function fetchIptvCategories(): Promise<string[]> {
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
  } catch (err) {}
}
