import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export interface UserReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string | null;
  authorAvatar: string | null;
}

export interface UserRatingStats {
  average: number;
  total: number;
  reviews: UserReview[];
}

export async function rateUser(
  targetUserId: string,
  rating: number,
  comment?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/ratings/${targetUserId}`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchUserRatings(targetUserId: string): Promise<UserRatingStats> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/ratings/${targetUserId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { average: 0, total: 0, reviews: [] };
    const data = await res.json();
    return {
      average: data.average || 0,
      total: data.total || 0,
      reviews: data.reviews || [],
    };
  } catch {
    return { average: 0, total: 0, reviews: [] };
  }
}
