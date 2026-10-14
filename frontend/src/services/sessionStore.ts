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
  const sessions = await fetchActiveSessions();
  const nextMap: Record<string, ActiveSessionInfo> = {};
  for (const s of sessions) {
    if (s.status === 'ACTIVE') {
      const cnt = s.participantCount || (s.participants ? s.participants.length : 1);
      nextMap[s.nodeId] = {
        sessionId: s.id,
        count: cnt,
        title: s.title,
        hostName: s.hostDisplayName,
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
      pollTimer = setInterval(refreshActiveSessions, 5000);
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
