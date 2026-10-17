import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';
import { MediaTileItem } from './taxonomyApi';
import { fetchWithCache, getCachedData } from './pwaDataCache';

export interface AuthorLocation {
  title: string;
  path: string;
  mediaId?: string;
  isLive?: boolean;
  positionSeconds?: number;
  label?: string;
}

export interface ForumMessage {
  id: string;
  topicSlug: string;
  topicTitle: string;
  authorId?: string | null;
  authorName: string;
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToAuthor?: string | null;
  voteCount?: number;
  hasVoted?: boolean;
  quotedMediaId?: string | null;
  quotedMediaTitle?: string | null;
  quotedMediaPoster?: string | null;
  authorLocation?: AuthorLocation | null;
  createdAt: string;
}

export interface TopicTagItem {
  code: string;
  value_text: string;
  value_slug: string;
  count: number;
}

export interface AssociationGroup {
  name: string;
  slug?: string;
  code?: string;
  count?: number;
  medias: MediaTileItem[];
}

export interface TopicContextResponse {
  success: boolean;
  topic: {
    slug: string;
    title: string;
    typeLabel: string;
    category?: string;
    overview?: string;
    fanartPath?: string;
    backdropUrl?: string | null;
    posterUrl?: string | null;
    totalMedias: number;
    averageRating?: string | null;
  };
  medias: MediaTileItem[];
  oeuvreGroups?: AssociationGroup[];
  actorGroups?: AssociationGroup[];
  studioGroups?: AssociationGroup[];
  genreGroups?: AssociationGroup[];
  tags: {
    actors?: TopicTagItem[];
    crew?: TopicTagItem[];
    studios?: TopicTagItem[];
    genres?: TopicTagItem[];
    countries?: TopicTagItem[];
  };
}

export interface ForumExploreResponse {
  success: boolean;
  activeDiscussions: {
    topicSlug: string;
    topicTitle: string;
    msgCount: number;
    lastMsgAt: string;
  }[];
  topActors: { title: string; slug: string; count: number }[];
  topCrew: { title: string; slug: string; role?: string; count: number }[];
  topStudios: { title: string; slug: string; count: number }[];
  topGenres: { title: string; slug: string; code?: string; count: number }[];
  oeuvreGroups?: AssociationGroup[];
  actorGroups?: AssociationGroup[];
  studioGroups?: AssociationGroup[];
  genreGroups?: AssociationGroup[];
}

export const INITIAL_EXPLORE_DATA: ForumExploreResponse = {
  success: true,
  activeDiscussions: [],
  topActors: [
    { title: 'John Ratzenberger', slug: 'john-ratzenberger', count: 1 },
    { title: 'Bonnie Hunt', slug: 'bonnie-hunt', count: 2 },
    { title: 'Bob Peterson', slug: 'bob-peterson', count: 2 },
    { title: 'Samuel L. Jackson', slug: 'samuel-l-jackson', count: 6 },
  ],
  topCrew: [],
  topStudios: [
    { title: 'Pixar', slug: 'pixar', count: 5 },
    { title: 'Warner Bros. Pictures', slug: 'warner-bros-pictures', count: 10 },
    { title: 'Columbia Pictures', slug: 'columbia-pictures', count: 10 },
    { title: '20th Century Fox', slug: '20th-century-fox', count: 10 },
  ],
  topGenres: [
    { title: 'United States of America', slug: 'united-states-of-america', code: 'country', count: 10 },
    { title: 'Action', slug: 'action', code: 'genre', count: 10 },
    { title: 'Comédie', slug: 'comedie', code: 'genre', count: 10 },
    { title: 'Drame', slug: 'drame', code: 'genre', count: 10 },
  ],
  oeuvreGroups: [],
  actorGroups: [],
  studioGroups: [],
  genreGroups: [],
};

export async function fetchTopicContext(
  topicSlug: string,
  title?: string,
  category?: string
): Promise<TopicContextResponse | null> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const params = new URLSearchParams();
    if (title) params.set('title', title);
    if (category) params.set('category', category);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/context${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchForumExplore(): Promise<ForumExploreResponse | null> {
  const cached = getCachedData<ForumExploreResponse>('forum_explore_data');
  return fetchWithCache<ForumExploreResponse>(
    'forum_explore_data',
    async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/forum/explore`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return cached || INITIAL_EXPLORE_DATA;
        const data = await res.json();
        return data.success ? data : cached || INITIAL_EXPLORE_DATA;
      } catch {
        return cached || INITIAL_EXPLORE_DATA;
      }
    },
    { staleTime: 1000 * 60 * 5 }
  );
}

export async function fetchTopicMessages(topicSlug: string): Promise<ForumMessage[]> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/messages`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.messages || [];
  } catch {
    return [];
  }
}

export async function postTopicMessage(
  topicSlug: string,
  payload: {
    topicTitle: string;
    content: string;
    authorName: string;
    authorId?: string;
    mediaType?: string;
    mediaUrl?: string;
    fileName?: string;
    replyToId?: string;
    replyToText?: string;
    replyToAuthor?: string;
    quotedMediaId?: string;
    quotedMediaTitle?: string;
    quotedMediaPoster?: string;
  }
): Promise<ForumMessage | null> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/messages`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.message || null;
  } catch {
    return null;
  }
}

export async function voteForumMessage(
  messageId: string
): Promise<{ success: boolean; voteCount: number; hasVoted: boolean }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/forum/messages/${messageId}/vote`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { success: false, voteCount: 0, hasVoted: false };
    return await res.json();
  } catch {
    return { success: false, voteCount: 0, hasVoted: false };
  }
}

export async function uploadForumMedia(
  file: File | Blob,
  fileName: string,
  mediaType: string
): Promise<{ success: boolean; url?: string; fileName?: string; mediaType?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file, fileName);
    const headers = { ...getAuthHeaders() };
    delete (headers as any)['Content-Type'];

    const res = await fetch(`${getApiBaseUrl()}/api/forum/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) return { success: false, error: `Erreur serveur HTTP ${res.status}` };
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
