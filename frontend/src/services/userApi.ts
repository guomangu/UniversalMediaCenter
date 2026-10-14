import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export async function fetchUserStats(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/stats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchContinueWatching(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/continue-watching`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function fetchWatchHistory(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/history`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.history || [];
  } catch {
    return [];
  }
}

export async function fetchFavorites(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/favorites`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.favorites || [];
  } catch {
    return [];
  }
}

export async function toggleFavorite(nodeId: string, shouldAdd: boolean): Promise<boolean> {
  try {
    const method = shouldAdd ? 'POST' : 'DELETE';
    const res = await fetch(`${getApiBaseUrl()}/api/user/favorites/${nodeId}`, {
      method,
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return Boolean(data.isFavorite);
  } catch {
    return false;
  }
}

export async function checkFavorite(nodeId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/favorites/check/${nodeId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.isFavorite);
  } catch {
    return false;
  }
}

export async function fetchUserForums(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/forums`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.forums || [];
  } catch {
    return [];
  }
}

export async function fetchUserProfile(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function updateUserProfile(data: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch {
    return { error: 'Erreur réseau' };
  }
}
