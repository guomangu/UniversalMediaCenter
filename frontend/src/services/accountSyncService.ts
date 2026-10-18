import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getCurrentUser } from './authStore';
import { playerStore, registerPlaybackBroadcaster } from './playerStore';
import { getActiveCastTarget, subscribeActiveCastTarget } from './castState';
import {
  getLocalDeviceId,
  getLocalSyncGroupId,
  setLocalSyncGroupId,
} from './deviceIdentity';

export { getLocalDeviceId, getLocalSyncGroupId, setLocalSyncGroupId };

export interface RemoteAccountPlayback {
  userId: string;
  deviceId: string;
  leaderDeviceId?: string;
  syncGroupId?: string;
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

let syncTimer: any = null;
let isPublishing = false;
let lastReportedTime = 0;
let lastRemoteSeekTime = 0;

export async function fetchAccountPlayback(): Promise<RemoteAccountPlayback | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const syncGroupId = getLocalSyncGroupId();
  // En mode autonome (standalone), l'appareil ne se synchronise pas avec les autres
  if (syncGroupId === 'standalone') return null;

  try {
    const deviceId = getLocalDeviceId();
    const res = await fetch(
      `${getApiBaseUrl()}/api/playback/sync?syncGroupId=${encodeURIComponent(syncGroupId)}&deviceId=${encodeURIComponent(deviceId)}`,
      {
        headers: getAuthHeaders(),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.playback || null;
  } catch {
    return null;
  }
}

export async function reportAccountPlayback(payload: Partial<RemoteAccountPlayback>, isAction = false): Promise<void> {
  const user = getCurrentUser();
  if (!user || isPublishing) return;

  const localState = playerStore.getState();
  const currentMediaId = payload.mediaId || localState.activeMedia?.id;
  if (!currentMediaId) return;

  const deviceId = getLocalDeviceId();
  const syncGroupId = getLocalSyncGroupId();
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
        syncGroupId,
        isCastActive,
        castTargetId: cast?.id,
        isAction,
        mediaId: currentMediaId,
        mediaTitle: payload.mediaTitle || localState.activeMedia?.title,
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
  const deviceId = getLocalDeviceId();
  const syncGroupId = getLocalSyncGroupId();
  try {
    await fetch(`${getApiBaseUrl()}/api/playback/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ deviceId, syncGroupId }),
    });
  } catch {}
}

// Enregistrement du diffuseur auprès du playerStore (élimine la dépendance circulaire)
registerPlaybackBroadcaster({
  report: (payload: any, isAction?: boolean) => reportAccountPlayback(payload, isAction),
  stop: stopAccountPlayback,
});

// Écoute des mises à jour du Cast pour synchroniser le compte
subscribeActiveCastTarget((live) => {
  if (live) {
    const st = playerStore.getState();
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
    }, true).catch(() => {});
  }
});

/**
 * Démarrer la boucle de synchronisation globale multi-appareils pour le compte.
 * Tous les lecteurs (web, mobile, Cast) connectés au même compte et partageant le même syncGroupId restent en miroir temps réel :
 * - Synchronisation ordonnée Leader / Follower (élimine définitivement les boucles de feedback et écrasements mutuels)
 * - Synchronisation bidirectionnelle de position, état play/pause, pistes audio (langues) et sous-titres
 * - Mode autonome (standalone) respecté pour autoriser plusieurs flux indépendants
 */
export function startAccountPlaybackSyncLoop() {
  if (syncTimer) return;

  syncTimer = setInterval(async () => {
    const user = getCurrentUser();
    if (!user) return;

    const localState = playerStore.getState();
    const activeLocal = localState.activeMedia;

    // Si le document est en arrière-plan et qu'aucun média ne joue localement, ralentir la boucle
    if (typeof document !== 'undefined' && document.hidden && !activeLocal?.isPlaying) {
      return;
    }

    const myDeviceId = getLocalDeviceId();
    const mySyncGroup = getLocalSyncGroupId();

    try {
      // Si l'appareil est en mode solo (standalone), il ne suit pas d'autres flux mais continue d'envoyer son statut
      if (mySyncGroup === 'standalone') {
        if (activeLocal) {
          const now = Date.now();
          if (now - lastReportedTime > 2500) {
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
            }, false).catch(() => {});
          }
        }
        return;
      }

      const remote = await fetchAccountPlayback();
      const now = Date.now();

      // Déterminer qui est le leader de la lecture
      const leaderId = remote?.leaderDeviceId || remote?.deviceId || '';
      const isRemoteActive = Boolean(remote && remote.mediaId && now - remote.updatedAt < 30_000);
      const isMeLeader = isRemoteActive && leaderId === myDeviceId;
      const isOtherLeader = isRemoteActive && leaderId !== myDeviceId;

      // 1. CAS LEADER : Cet appareil est le leader du groupe (ou diffuse en premier sans leader distant)
      if (isMeLeader || (activeLocal && !isOtherLeader)) {
        if (activeLocal) {
          if (now - lastReportedTime > 2200) {
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
            }, false).catch(() => {});
          }
        }
        return;
      }

      // 2. CAS FOLLOWER : Un AUTRE appareil est le leader actif du groupe
      if (isOtherLeader && remote) {
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
            isRemoteSync: true, // IMPORTANT: Ne pas re-diffuser en écrasant le leader !
          });
          return;
        }

        // B) Même média : réconcilier play/pause, position temporelle, langues et sous-titres
        if (activeLocal && activeLocal.id === remote.mediaId) {
          // Play / Pause
          if (activeLocal.isPlaying !== remote.isPlaying) {
            playerStore.syncPlayingFromRemote(remote.isPlaying);
          }

          // Dérive temporelle > 2.0 secondes avec temporisation
          if (Math.abs(activeLocal.positionSeconds - remote.positionSeconds) > 2.0) {
            if (now - lastRemoteSeekTime > 2500) {
              lastRemoteSeekTime = now;
              playerStore.seekTo(remote.positionSeconds, false);
            }
          }

          // Langue audio
          if (remote.activeAudio && remote.activeAudio !== 'auto' && activeLocal.activeAudio !== remote.activeAudio) {
            playerStore.syncAudioFromRemote(remote.activeAudio);
          }

          // Sous-titre
          if (remote.activeSubtitle && activeLocal.activeSubtitle !== remote.activeSubtitle) {
            playerStore.syncSubtitleFromRemote(remote.activeSubtitle);
          }
        }
      }
    } catch {}
  }, 1800);
}

if (typeof window !== 'undefined') {
  startAccountPlaybackSyncLoop();
}
