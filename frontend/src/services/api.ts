import { UiRailItem, MediaDetailResponse, MediaStatsResponse } from './types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function resolveImageUrl(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  if (uri.startsWith('/')) return `${API_BASE}${uri}`;
  return uri;
}

export function getVideoStreamUrl(id: string): string {
  return `${API_BASE}/api/media/${id}/stream`;
}

export async function fetchHomeLayout(): Promise<UiRailItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/ui/layout?page=HOME`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.rails || [];
  } catch (err) {
    return [];
  }
}

export async function fetchMediaDetail(id: string): Promise<MediaDetailResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/media/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchMediaStats(): Promise<MediaStatsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/media/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function triggerLibraryRefresh(limit = 40): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/library/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function searchCatalog(query: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { nodes: [], tags: [], people: [] };
  }
}

export async function fetchLiveChannels(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/iptv/channels`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.channels || [];
  } catch (err) {
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
    await fetch(`${API_BASE}/api/media/${nodeId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, positionSeconds, durationSeconds }),
    });
  } catch (err) {}
}
