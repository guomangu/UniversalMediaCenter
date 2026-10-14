import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getCurrentUser } from './authStore';

export interface SessionParticipant {
  userId: string;
  displayName: string;
  isHost: boolean;
  isMuted: boolean;
  isIncognito?: boolean;
}

export interface MediaSession {
  id: string;
  nodeId: string;
  topicSlug: string;
  hostUserId: string;
  hostDisplayName: string;
  title: string;
  scheduledAt: string;
  status: 'ACTIVE' | 'SCHEDULED' | 'ENDED';
  currentPosition: number;
  isPlaying: boolean;
  createdAt: string;
  participants?: SessionParticipant[];
  participantCount?: number;
}

export interface ActiveSessionsResponse {
  sessions: MediaSession[];
  activeMediaCounts: Record<string, { count: number; title: string; isPlaying: boolean }>;
}

export async function fetchActiveSessions(): Promise<ActiveSessionsResponse> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sessions/active`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { sessions: [], activeMediaCounts: {} };
    const data = await res.json();
    return {
      sessions: data.sessions || [],
      activeMediaCounts: data.activeMediaCounts || {},
    };
  } catch {
    return { sessions: [], activeMediaCounts: {} };
  }
}

export async function fetchMediaSessions(nodeId: string): Promise<{
  sessions: MediaSession[];
  totalViewers: number;
  hasActiveSession: boolean;
}> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sessions/media/${nodeId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { sessions: [], totalViewers: 0, hasActiveSession: false };
    const data = await res.json();
    return {
      sessions: data.sessions || [],
      totalViewers: data.totalViewers || 0,
      hasActiveSession: !!data.hasActiveSession,
    };
  } catch {
    return { sessions: [], totalViewers: 0, hasActiveSession: false };
  }
}

export async function createSession(data: {
  nodeId: string;
  topicSlug: string;
  title: string;
  scheduledAt?: string;
}): Promise<MediaSession | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sessions`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.session || null;
  } catch {
    return null;
  }
}

export async function joinSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function leaveSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sessions/${sessionId}/leave`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pingSession(
  sessionId: string,
  payload: { isMuted?: boolean; currentPosition?: number }
): Promise<MediaSession | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sessions/${sessionId}/ping`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.session || null;
  } catch {
    return null;
  }
}

export async function reportPlaybackProgress(
  nodeId: string,
  positionSeconds: number,
  durationSeconds: number,
  isPlaying = true
): Promise<void> {
  try {
    const user = getCurrentUser();
    await fetch(`${getApiBaseUrl()}/api/media/${nodeId}/progress`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id,
        positionSeconds,
        durationSeconds,
        isPlaying,
      }),
    });
  } catch {}
}

export async function leavePlayback(nodeId: string): Promise<void> {
  try {
    const user = getCurrentUser();
    await fetch(`${getApiBaseUrl()}/api/media/${nodeId}/playback`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id }),
    });
  } catch {}
}

// --- APPELS VOCAUX EN DIRECT (VOICE CALL ROOMS) ---

export async function joinVoiceCall(
  topicSlug: string,
  isMuted = false
): Promise<{ success: boolean; participants: SessionParticipant[] }> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/call/join`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMuted }),
    });
    if (!res.ok) return { success: false, participants: [] };
    const data = await res.json();
    return { success: true, participants: data.participants || [] };
  } catch {
    return { success: false, participants: [] };
  }
}

export async function leaveVoiceCall(topicSlug: string): Promise<boolean> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/call/leave`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pingVoiceCall(
  topicSlug: string,
  isMuted?: boolean
): Promise<{ success: boolean; participants: SessionParticipant[] }> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/call/ping`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMuted }),
    });
    if (!res.ok) return { success: false, participants: [] };
    const data = await res.json();
    return { success: true, participants: data.participants || [] };
  } catch {
    return { success: false, participants: [] };
  }
}

export async function getVoiceCallStatus(
  topicSlug: string
): Promise<{ activeCount: number; participants: SessionParticipant[] }> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/call/status`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { activeCount: 0, participants: [] };
    const data = await res.json();
    return { activeCount: data.activeCount || 0, participants: data.participants || [] };
  } catch {
    return { activeCount: 0, participants: [] };
  }
}

export async function sendVoiceAudioChunk(
  topicSlug: string,
  audioBase64: string,
  mimeType = 'audio/webm'
): Promise<boolean> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/call/chunk`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getVoiceAudioChunks(
  topicSlug: string,
  since: number
): Promise<Array<{ id: string; senderId: string; senderName: string; audioBase64: string; mimeType: string; timestamp: number }>> {
  try {
    const slug = encodeURIComponent(topicSlug.toLowerCase().trim());
    const res = await fetch(`${getApiBaseUrl()}/api/forum/topics/${slug}/call/chunks?since=${since}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.chunks || [];
  } catch {
    return [];
  }
}
