import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export async function createRepost(
  nodeId: string,
  rating?: number | null,
  comment?: string | null
): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/reposts/media/${nodeId}`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    });
    return await res.json();
  } catch {
    return { error: 'Erreur réseau' };
  }
}

export async function fetchMediaReposts(nodeId: string): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/reposts/media/${nodeId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reposts || [];
  } catch {
    return [];
  }
}

export async function fetchUserReposts(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/reposts/user`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reposts || [];
  } catch {
    return [];
  }
}

export async function fetchFeedReposts(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/reposts/feed`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.feed || [];
  } catch {
    return [];
  }
}

export async function deleteRepost(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/reposts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
