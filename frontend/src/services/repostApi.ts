import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export interface MediaRepostItem {
  id: string;
  nodeId: string;
  rating?: number | null;
  comment?: string | null;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  media?: any;
  node?: any;
  isMine?: boolean;
  isFriend?: boolean;
}

export interface MediaRepostsResponse {
  reposts: MediaRepostItem[];
  averageRating: number | null;
  totalCount: number;
}

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
    return { error: 'Erreur réseau lors de la publication' };
  }
}

export async function fetchMediaReposts(nodeId: string): Promise<MediaRepostsResponse> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/reposts/media/${nodeId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { reposts: [], averageRating: null, totalCount: 0 };
    const data = await res.json();
    return {
      reposts: data.reposts || [],
      averageRating: data.averageRating ?? null,
      totalCount: data.totalCount ?? (data.reposts?.length || 0),
    };
  } catch {
    return { reposts: [], averageRating: null, totalCount: 0 };
  }
}

export async function fetchUserReposts(): Promise<MediaRepostItem[]> {
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

export async function fetchFriendsReposts(): Promise<MediaRepostItem[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/reposts/friends`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reposts || [];
  } catch {
    return [];
  }
}

export async function fetchFeedReposts(): Promise<MediaRepostItem[]> {
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
