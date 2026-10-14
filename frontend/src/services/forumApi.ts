import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

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
  }
): Promise<ForumMessage | null> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.message || null;
  } catch {
    return null;
  }
}
