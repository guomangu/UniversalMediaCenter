import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getCurrentUser } from './authStore';
import { playerStore } from './playerStore';
import { getActiveCastTarget } from './castState';

export interface RemoteAccountPlayback {
  userId: string;
  deviceId: string;
  mediaId: string;
  mediaTitle: string;
  posterUrl?: string;
  streamUrl?: string;
  isLive?: boolean;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  activeAudio: string;
  activeSubtitle: string;
  volume: number;
  isMuted: boolean;
  isCastActive?: boolean;
  castTargetId?: string;
  updatedAt: number;
}

const DEVICE_STORAGE_KEY = 'ums_account_device_id';

export function getLocalDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'device_srv_' + Math.random().toString(36).substring(2, 9);
  }
  let id = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
  }
  return id;
}

let syncTimer: any = null;
let isPublishing = false;
let lastReportedTime = 0;

export async function fetchAccountPlayback(): Promise<RemoteAccountPlayback | null> {
  const user = getCurrentUser();
  if (!user) return null;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/playback/sync`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.playback || null;
  } catch {
    return null;
  }
}

export async function reportAccountPlayback(payload: Partial<RemoteAccountPlayback>): Promise<void> {
  const user = getCurrentUser();
  if (!user || isPublishing) return;

  const deviceId = getLocalDeviceId();
  const cast = getActiveCastTarget();
  const isCastActive = Boolean(cast);

  isPublishing = true;
  try {
    await fetch(`${getApiBaseUrl()}/api/playback/sync`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        isCastActive,
        castTargetId: cast?.id,
        ...payload,
      }),
    });
  } catch {} finally {
    isPublishing = false;
  }
}

export async function stopAccountPlayback(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  try {
    await fetch(`${getApiBaseUrl()}/api/playback/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {}
}

/**
 * Démarre la boucle de synchronisation globale multi-appareils pour le compte.
 * Tous les lecteurs (web, mobile, Cast) connectés au même compte restent en miroir temps réel :
 * - 1 seule lecture simultanée par compte
 * - Synchronisation bidirectionnelle de position, état play/pause, pistes audio (langues) et sous-titres
 */
export function startAccountPlaybackSyncLoop() {
  if (syncTimer) return;

  syncTimer = setInterval(async () => {
    const user = getCurrentUser();
    if (!user) return;

    const myDeviceId = getLocalDeviceId();
    const localState = playerStore.getState();
    const activeLocal = localState.activeMedia;

    try {
      const remote = await fetchAccountPlayback();

      // 1. Si une lecture distante existe sur un AUTRE appareil du même compte (ou sur un écran Cast)
      if (remote && remote.deviceId !== myDeviceId) {
        // A) Média différent : aligner le lecteur local sur le média en cours du compte
        if (!activeLocal || activeLocal.id !== remote.mediaId) {
          playerStore.openMedia({
            id: remote.mediaId,
            title: remote.mediaTitle,
            posterUrl: remote.posterUrl,
            streamUrl: remote.streamUrl || `${getApiBaseUrl()}/api/media/${remote.mediaId}/stream`,
            isLive: remote.isLive,
            activeAudio: remote.activeAudio,
            activeSubtitle: remote.activeSubtitle,
            initialTime: remote.positionSeconds,
          });
          return;
        }

        // B) Même média : réconcilier play/pause, position temporelle, langues et sous-titres
        if (activeLocal && activeLocal.id === remote.mediaId) {
          // Play / Pause
          if (activeLocal.isPlaying !== remote.isPlaying) {
            playerStore.syncPlayingFromRemote(remote.isPlaying);
          }

          // Dérive temporelle > 2.5 secondes
          if (Math.abs(activeLocal.positionSeconds - remote.positionSeconds) > 2.5) {
            playerStore.seekTo(remote.positionSeconds, false);
          }

          // Langue audio
          if (remote.activeAudio && activeLocal.activeAudio !== remote.activeAudio) {
            playerStore.syncAudioFromRemote(remote.activeAudio);
          }

          // Sous-titre
          if (remote.activeSubtitle && activeLocal.activeSubtitle !== remote.activeSubtitle) {
            playerStore.syncSubtitleFromRemote(remote.activeSubtitle);
          }
        }
      } else if (activeLocal && (!remote || remote.deviceId === myDeviceId)) {
        // 2. Si c'est CET appareil qui diffuse le média : envoyer le battement de cœur régulier
        const now = Date.now();
        if (now - lastReportedTime > 2000) {
          lastReportedTime = now;
          reportAccountPlayback({
            mediaId: activeLocal.id,
            mediaTitle: activeLocal.title,
            posterUrl: activeLocal.posterUrl,
            streamUrl: activeLocal.streamUrl,
            isLive: activeLocal.isLive,
            positionSeconds: activeLocal.positionSeconds,
            durationSeconds: activeLocal.durationSeconds,
            isPlaying: activeLocal.isPlaying,
            activeAudio: activeLocal.activeAudio,
            activeSubtitle: activeLocal.activeSubtitle,
            volume: localState.volume,
            isMuted: localState.isMuted,
          }).catch(() => {});
        }
      }
    } catch {}
  }, 1400);
}
