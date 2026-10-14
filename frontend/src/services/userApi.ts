import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, updateCurrentUser } from './authStore';

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

export async function updateUserProfile(data: { displayName?: string; bio?: string; avatarUrl?: string; isIncognito?: boolean }): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (body.success && body.user) {
      updateCurrentUser(body.user);
    }
    return body;
  } catch {
    return { error: 'Erreur réseau' };
  }
}

export async function toggleIncognitoMode(enabled?: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/incognito`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    updateCurrentUser({ isIncognito: data.isIncognito });
    return Boolean(data.isIncognito);
  } catch {
    return false;
  }
}
