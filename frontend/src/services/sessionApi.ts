import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

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

export async function fetchActiveSessions(): Promise<MediaSession[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sessions/active`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch {
    return [];
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
