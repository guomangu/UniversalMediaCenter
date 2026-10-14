import { UiRailItem, MediaDetailResponse } from './types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export async function fetchHomeLayout(): Promise<UiRailItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/ui/layout?page=HOME`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.rails || [];
  } catch (err) {
    console.warn('API fetchHomeLayout fallback:', err);
    return [];
  }
}

export async function fetchMediaDetail(id: string): Promise<MediaDetailResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/media/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API fetchMediaDetail fallback:', err);
    return null;
  }
}

export async function searchCatalog(query: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API searchCatalog fallback:', err);
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
    console.warn('API fetchLiveChannels fallback:', err);
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
  } catch (err) {
    console.warn('Failed to save progress:', err);
  }
}
