import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getCurrentUser } from './authStore';
import { playerStore, registerPlaybackBroadcaster } from './playerStore';
import { getActiveCastTarget, subscribeActiveCastTarget } from './castState';
import {
  getLocalDeviceId,
  getLocalPlaybackDeviceId,
  getLocalSyncGroupId,
  setLocalSyncGroupId,
} from './deviceIdentity';

export { getLocalDeviceId, getLocalPlaybackDeviceId, getLocalSyncGroupId, setLocalSyncGroupId };

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
  orderSeq?: number;
  originDeviceId?: string;
  actionType?: string;
  actionTimestamp?: number;
  updatedAt: number;
}

let syncTimer: any = null;
let isPublishing = false;
let pendingReport: { payload: Partial<RemoteAccountPlayback>; isAction: boolean } | null = null;
let lastReportedTime = 0;
let lastRemoteSeekTime = 0;
let lastAppliedOrderSeq = 0;

// Canal de communication instantané entre onglets/fenêtres du même navigateur (0 ms latency)
let localBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    localBroadcastChannel = new BroadcastChannel('ums_playback_sync_channel');
    localBroadcastChannel.onmessage = (event) => {
      const { type, payload, senderDeviceId } = event.data || {};
      const myDeviceId = getLocalPlaybackDeviceId();
      if (!payload || senderDeviceId === myDeviceId) return;

      const mySyncGroup = getLocalSyncGroupId();
      if (mySyncGroup === 'standalone' || (payload.syncGroupId && payload.syncGroupId !== mySyncGroup)) {
        return;
      }

      if (type === 'PLAYBACK_ACTION') {
        applyRemoteOrder(payload);
      }
    };
  } catch {}
}

export async function fetchAccountPlayback(): Promise<RemoteAccountPlayback | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const syncGroupId = getLocalSyncGroupId();
  // En mode autonome (standalone), l'appareil ne se synchronise pas avec les autres
  if (syncGroupId === 'standalone') return null;

  try {
    const deviceId = getLocalPlaybackDeviceId();
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
  if (!user) return;

  // Si une publication est déjà en vol, mettre en file d'attente pour ne JAMAIS perdre l'action utilisateur
  if (isPublishing) {
    pendingReport = {
      payload: { ...(pendingReport?.payload || {}), ...payload },
      isAction: Boolean(isAction || pendingReport?.isAction),
    };
    return;
  }

  const localState = playerStore.getState();
  const currentMediaId = payload.mediaId || localState.activeMedia?.id;
  if (!currentMediaId) return;

  const deviceId = getLocalPlaybackDeviceId();
  const syncGroupId = getLocalSyncGroupId();
  const cast = getActiveCastTarget();
  const isCastActive = Boolean(cast);

  // Diffusion instantanée en local pour les autres onglets du même navigateur
  if (isAction && localBroadcastChannel) {
    try {
      localBroadcastChannel.postMessage({
        type: 'PLAYBACK_ACTION',
        senderDeviceId: deviceId,
        payload: {
          mediaId: currentMediaId,
          mediaTitle: payload.mediaTitle || localState.activeMedia?.title,
          posterUrl: payload.posterUrl || localState.activeMedia?.posterUrl,
          streamUrl: payload.streamUrl || localState.activeMedia?.streamUrl,
          isLive: payload.isLive ?? localState.activeMedia?.isLive,
          positionSeconds: payload.positionSeconds ?? localState.activeMedia?.positionSeconds ?? 0,
          durationSeconds: payload.durationSeconds ?? localState.activeMedia?.durationSeconds ?? 0,
          isPlaying: payload.isPlaying ?? localState.activeMedia?.isPlaying ?? false,
          activeAudio: payload.activeAudio || localState.activeMedia?.activeAudio || 'auto',
          activeSubtitle: payload.activeSubtitle || localState.activeMedia?.activeSubtitle || 'off',
          syncGroupId,
          originDeviceId: deviceId,
          updatedAt: Date.now(),
        },
      });
    } catch {}
  }

  isPublishing = true;
  try {
    await fetch(`${getApiBaseUrl()}/api/playback/sync`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
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
    if (pendingReport) {
      const next = pendingReport;
      pendingReport = null;
      reportAccountPlayback(next.payload, next.isAction).catch(() => {});
    }
  }
}

export async function stopAccountPlayback(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  const deviceId = getLocalPlaybackDeviceId();
  const syncGroupId = getLocalSyncGroupId();

  if (localBroadcastChannel) {
    try {
      localBroadcastChannel.postMessage({
        type: 'PLAYBACK_STOP',
        senderDeviceId: deviceId,
        syncGroupId,
      });
    } catch {}
  }

  try {
    await fetch(`${getApiBaseUrl()}/api/playback/stop`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'x-device-id': deviceId,
      },
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
 * Applique de manière autoritaire un ordre officiel provenant du serveur ou du BroadcastChannel.
 * Ne ré-émet aucun événement synthétique vers le réseau (élimine la boucle infinie ping-pong).
 */
function applyRemoteOrder(remote: RemoteAccountPlayback) {
  // RÈGLE ABSOLUE : En aucun cas une synchronisation distante avec son propre et même appareil !
  const myDeviceId = getLocalPlaybackDeviceId();
  const myBaseId = getLocalDeviceId();
  const remoteOrigin = remote.originDeviceId || remote.leaderDeviceId || remote.deviceId || "";

  const isSelf =
    remoteOrigin === myDeviceId ||
    remoteOrigin === myBaseId ||
    remoteOrigin.startsWith(myBaseId + "_") ||
    myDeviceId.startsWith(remoteOrigin + "_") ||
    (remote.deviceId && (remote.deviceId === myDeviceId || remote.deviceId === myBaseId || remote.deviceId.startsWith(myBaseId + "_")));

  if (isSelf) {
    return;
  }

  const localState = playerStore.getState();
  const activeLocal = localState.activeMedia;
  const now = Date.now();

  if (remote.orderSeq && remote.orderSeq > lastAppliedOrderSeq) {
    lastAppliedOrderSeq = remote.orderSeq;
  }

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
      isRemoteSync: true, // IMPORTANT: Ne pas re-diffuser en écrasant l'ordre !
    });
    return;
  }

  // B) Même média : réconcilier Play/Pause, position temporelle, langues et sous-titres
  if (activeLocal && activeLocal.id === remote.mediaId) {
    // Play / Pause
    if (activeLocal.isPlaying !== remote.isPlaying) {
      playerStore.syncPlayingFromRemote(remote.isPlaying);
    }

    // Calcul de la position théorique attendue avec l'écoulement naturel du temps
    const elapsed = remote.isPlaying ? Math.max(0, (now - (remote.updatedAt || now)) / 1000) : 0;
    const expectedPosition = (Number(remote.positionSeconds) || 0) + elapsed;

    // Dérive temporelle > 2.5 secondes avec temporisation
    if (Math.abs(activeLocal.positionSeconds - expectedPosition) > 2.5) {
      if (now - lastRemoteSeekTime > 2000) {
        lastRemoteSeekTime = now;
        playerStore.seekTo(expectedPosition, false, false);
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

/**
 * Démarrer la boucle de synchronisation globale multi-appareils pour le compte.
 * Architecture : Appareil 1 ou 2 interagissant avec le player → Serveur → Appareils 1 et 2 synchronisés recevant le nouvel ordre.
 */
export function startAccountPlaybackSyncLoop() {
  if (syncTimer) return;

  const checkRemoteChanges = async () => {
    const user = getCurrentUser();
    if (!user) return;

    const mySyncGroup = getLocalSyncGroupId();
    if (mySyncGroup === 'standalone') return;

    // Si l'utilisateur local manipule actuellement le lecteur, ne pas perturber
    if (playerStore.isWithinUserGracePeriod(2500)) return;

    try {
      const remote = await fetchAccountPlayback();
      const now = Date.now();
      if (!remote || !remote.mediaId || now - remote.updatedAt > 60_000) return;

      const orderOrigin = remote.originDeviceId || remote.leaderDeviceId || remote.deviceId || '';
      const myDeviceId = getLocalPlaybackDeviceId();

      // Si l'ordre vient de cet appareil lui-même, aucun besoin de s'écraser soi-même
      if (orderOrigin === myDeviceId) return;

      // Un autre appareil a émis un ordre ou un changement : s'aligner
      applyRemoteOrder(remote);
    } catch {}
  };

  // Fréquence douce au repos (10s) pour détecter les changements initiés sur d'autres appareils du compte
  syncTimer = setInterval(checkRemoteChanges, 10_000);

  // Vérification instantanée lors du retour sur l'onglet ou au focus de la fenêtre
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', checkRemoteChanges);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkRemoteChanges();
      }
    });
  }
}

if (typeof window !== 'undefined') {
  startAccountPlaybackSyncLoop();
}
