import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export interface AuthorLocation {
  title: string;
  path: string;
  mediaId?: string;
  isLive?: boolean;
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
