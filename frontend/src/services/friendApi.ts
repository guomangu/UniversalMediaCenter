import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export async function fetchFriends(): Promise<{ friends: any[]; pendingReceived: any[]; pendingSent: any[] }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/friends`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { friends: [], pendingReceived: [], pendingSent: [] };
    return await res.json();
  } catch {
    return { friends: [], pendingReceived: [], pendingSent: [] };
  }
}

export async function sendFriendRequest(target: { targetEmail?: string; targetUserId?: string }): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/friends/request`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    });
    return await res.json();
  } catch {
    return { error: 'Erreur réseau' };
  }
}

export async function acceptFriend(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/friends/accept/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch {
    return { error: 'Erreur réseau' };
  }
}

export async function rejectFriend(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/friends/reject/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch {
    return { error: 'Erreur réseau' };
  }
}

export async function searchUsers(q: string): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/friends/search?q=${encodeURIComponent(q)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}
