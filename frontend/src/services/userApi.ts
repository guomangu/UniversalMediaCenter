import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, updateCurrentUser } from './authStore';
import { fetchWithCache, setCachedData, getCachedData } from './pwaDataCache';
import { getUserCacheKey } from './api';

export async function fetchUserStats(): Promise<any> {
  const cacheKey = `user_stats_${getUserCacheKey()}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/stats`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  });
}

export async function fetchContinueWatching(): Promise<any[]> {
  const cacheKey = `user_continue_watching_${getUserCacheKey()}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/continue-watching`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.items || [];
    } catch {
      return [];
    }
  });
}

export async function fetchWatchHistory(): Promise<any[]> {
  const cacheKey = `user_history_${getUserCacheKey()}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/history`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.history || [];
    } catch {
      return [];
    }
  });
}

export async function fetchFavorites(forceFresh = false): Promise<any[]> {
  const cacheKey = `user_favorites_${getUserCacheKey()}`;
  const fetcher = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/favorites`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.favorites || [];
    } catch {
      return [];
    }
  };

  if (forceFresh) {
    const fresh = await fetcher();
    setCachedData(cacheKey, fresh);
    return fresh;
  }

  return fetchWithCache(cacheKey, fetcher);
}

export async function toggleFavorite(nodeId: string, shouldAdd: boolean): Promise<boolean> {
  try {
    const method = shouldAdd ? 'POST' : 'DELETE';
    const res = await fetch(`${getApiBaseUrl()}/api/user/favorites/${nodeId}`, {
      method,
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    // Mise à jour optimiste du cache PWA
    const cacheKey = `user_favorites_${getUserCacheKey()}`;
    const currentFavs = getCachedData<any[]>(cacheKey);
    if (Array.isArray(currentFavs)) {
      if (shouldAdd) {
        setCachedData(cacheKey, [{ id: nodeId }, ...currentFavs]);
      } else {
        setCachedData(cacheKey, currentFavs.filter((f) => f.id !== nodeId));
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: { nodeId, shouldAdd } }));
    }
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
  const cacheKey = `user_forums_${getUserCacheKey()}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/forums`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.forums || [];
    } catch {
      return [];
    }
  });
}

export async function updateProfile(data: { displayName?: string; avatarUrl?: string; pin?: string }): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (body.user) {
      updateCurrentUser(body.user);
    }
    return body;
  } catch {
    return { error: 'Erreur réseau' };
  }
}

export async function fetchUserProfile(): Promise<any> {
  const cacheKey = `user_profile_${getUserCacheKey()}`;
  return fetchWithCache(cacheKey, async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  });
}

export async function updateUserProfile(data: { displayName?: string; bio?: string; avatarUrl?: string; isIncognito?: boolean; pin?: string }): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (body.user) {
      updateCurrentUser(body.user);
      setCachedData(`user_profile_${getUserCacheKey()}`, body.user);
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
