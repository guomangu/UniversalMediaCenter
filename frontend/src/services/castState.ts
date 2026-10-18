import { useState, useEffect } from 'react';
import {
  fetchDeviceStatus,
  sendCastCommand,
  endGoogleCastSession,
  CastDevice,
} from './castService';
import { playerStore } from './playerStore';
import { reportAccountPlayback } from './accountSyncService';

const STORAGE_ACTIVE_CAST_KEY = 'ums_active_cast_target_id';

let activeTarget: CastDevice | null = null;
const listeners = new Set<(target: CastDevice | null) => void>();
let pollTimer: any = null;

function notifyListeners() {
  listeners.forEach((fn) => fn(activeTarget));
}

function startSyncLoop(targetId: string) {
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    if (!activeTarget || activeTarget.id !== targetId) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    try {
      const live = await fetchDeviceStatus(targetId);
      if (live) {
        activeTarget = live;
        notifyListeners();

        // Maintien du lecteur du site en synchronisation totale avec le média casté
        try {
          const st = playerStore.getState();
          if (st.activeMedia) {
            if (typeof live.positionSeconds === 'number' && Math.abs(st.activeMedia.positionSeconds - live.positionSeconds) > 1.2) {
              st.activeMedia.positionSeconds = live.positionSeconds;
            }
            if (typeof live.durationSeconds === 'number' && live.durationSeconds > 0) {
              st.activeMedia.durationSeconds = live.durationSeconds;
            }
            const isLivePlaying = Boolean(live.isPlaying);
            if (st.activeMedia.isPlaying !== isLivePlaying) {
              st.activeMedia.isPlaying = isLivePlaying;
            }
            if (live.audioTrack && st.activeMedia.activeAudio !== live.audioTrack) {
              st.activeMedia.activeAudio = live.audioTrack;
            }
            if (live.subtitleTrack && st.activeMedia.activeSubtitle !== live.subtitleTrack) {
              st.activeMedia.activeSubtitle = live.subtitleTrack;
            }
          }
          // Reporter la synchronisation active vers les autres appareils du compte
          reportAccountPlayback({
            mediaId: live.currentMediaId || st.activeMedia?.id,
            mediaTitle: live.mediaTitle || st.activeMedia?.title,
            positionSeconds: live.positionSeconds || 0,
            durationSeconds: live.durationSeconds || 0,
            isPlaying: Boolean(live.isPlaying),
            activeAudio: live.audioTrack || st.activeMedia?.activeAudio || 'auto',
            activeSubtitle: live.subtitleTrack || st.activeMedia?.activeSubtitle || 'off',
            isCastActive: true,
            castTargetId: live.id,
          }).catch(() => {});
        } catch {}
      } else {
        // Appareil cible hors ligne ou déconnecté
        activeTarget = null;
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(STORAGE_ACTIVE_CAST_KEY);
        }
        clearInterval(pollTimer);
        pollTimer = null;
        notifyListeners();
      }
    } catch {}
  }, 1200);
}

// Réhydratation automatique au démarrage si une session de Cast était active
if (typeof window !== 'undefined' && window.localStorage) {
  const savedId = localStorage.getItem(STORAGE_ACTIVE_CAST_KEY);
  if (savedId) {
    fetchDeviceStatus(savedId).then((dev) => {
      if (dev) {
        activeTarget = dev;
        notifyListeners();
        startSyncLoop(dev.id);
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_CAST_KEY);
      }
    }).catch(() => {});
  }
}

export function getActiveCastTarget(): CastDevice | null {
  return activeTarget;
}

export function setActiveCastTarget(target: CastDevice | null): void {
  activeTarget = target;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (target?.id) {
      localStorage.setItem(STORAGE_ACTIVE_CAST_KEY, target.id);
      startSyncLoop(target.id);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_CAST_KEY);
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  }
  notifyListeners();
}

/**
 * Déconnecte totalement le Cast :
 * - Arrête éventuellement la lecture sur l'écran cible (si stopTarget = true)
 * - Coupe la session Google Cast SDK
 * - Réinitialise la télécommande locale et purge le localStorage
 */
export async function disconnectCastTotally(stopTarget = false): Promise<void> {
  if (activeTarget) {
    if (stopTarget) {
      try {
        await sendCastCommand(activeTarget.id, 'STOP');
      } catch {}
    }
  }

  // Fin de session Google Cast
  endGoogleCastSession();

  // Nettoyage complet
  setActiveCastTarget(null);
}

export function useActiveCastTarget(): CastDevice | null {
  const [target, setTarget] = useState<CastDevice | null>(activeTarget);
  useEffect(() => {
    listeners.add(setTarget);
    return () => {
      listeners.delete(setTarget);
    };
  }, []);
  return target;
}
