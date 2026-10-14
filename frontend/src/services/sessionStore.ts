import { useState, useEffect } from 'react';
import { fetchActiveSessions, MediaSession } from './sessionApi';

export interface ActiveSessionInfo {
  sessionId: string;
  count: number;
  title: string;
  hostName: string;
}

let activeSessionsMap: Record<string, ActiveSessionInfo> = {};
const listeners = new Set<(map: Record<string, ActiveSessionInfo>) => void>();
let pollTimer: any = null;

export async function refreshActiveSessions(): Promise<Record<string, ActiveSessionInfo>> {
  const { sessions, activeMediaCounts } = await fetchActiveSessions();
  const nextMap: Record<string, ActiveSessionInfo> = {};

  // 1. D'abord les séances formelles (mediaSessions)
  for (const s of sessions) {
    if (s.status === 'ACTIVE') {
      const cnt = s.participantCount || (s.participants ? s.participants.length : 1);
      if (cnt > 0) {
        nextMap[s.nodeId] = {
          sessionId: s.id,
          count: cnt,
          title: s.title,
          hostName: s.hostDisplayName,
        };
      }
    }
  }

  // 2. Ensuite les spectateurs en visionnage actif (solo ou groupe via presenceStore)
  for (const [nodeId, info] of Object.entries(activeMediaCounts || {})) {
    if (info && info.count > 0) {
      const existing = nextMap[nodeId];
      nextMap[nodeId] = {
        sessionId: existing?.sessionId || `playback-${nodeId}`,
        count: existing ? Math.max(existing.count, info.count) : info.count,
        title: info.title || existing?.title || 'En cours',
        hostName: existing?.hostName || 'Spectateur',
      };
    }
  }

  activeSessionsMap = nextMap;
  listeners.forEach((fn) => fn(activeSessionsMap));
  return activeSessionsMap;
}

export function useActiveSessionsMap(): Record<string, ActiveSessionInfo> {
  const [map, setMap] = useState<Record<string, ActiveSessionInfo>>(activeSessionsMap);

  useEffect(() => {
    const fn = (m: Record<string, ActiveSessionInfo>) => setMap({ ...m });
    listeners.add(fn);

    if (!pollTimer) {
      refreshActiveSessions();
      pollTimer = setInterval(refreshActiveSessions, 4000);
    }

    return () => {
      listeners.delete(fn);
      if (listeners.size === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }, []);

  return map;
}
