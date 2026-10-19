import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getCurrentUser, logout } from './authStore';
import { playerStore } from './playerStore';
import { getVideoStreamUrl } from './api';
import {
  getLocalDeviceId,
  getLocalDeviceName,
  setLocalDeviceName,
  getLocalDeviceType,
  getLocalSyncGroupId,
  setLocalSyncGroupId,
  UserDeviceType,
} from './deviceIdentity';

export {
  getLocalDeviceId,
  getLocalDeviceName,
  setLocalDeviceName,
  getLocalDeviceType,
  getLocalSyncGroupId,
  setLocalSyncGroupId,
  UserDeviceType,
};

export interface DevicePlaybackState {
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
  updatedAt: number;
}

export interface UserConnectedDevice {
  deviceId: string;
  userId: string;
  name: string;
  customName?: string;
  deviceType: UserDeviceType;
  clientInfo?: string;
  userAgent?: string;
  ip?: string;
  lastSeenAt: number;
  createdAt: number;
  isOnline?: boolean;
  currentRoute?: string;
  pageTitle?: string;
  syncGroupId: string; // 'default' ou 'standalone'
  currentPlayback?: DevicePlaybackState;
  isCurrentDevice?: boolean;
}

export type DeviceAction =
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'STOP'
  | 'SET_VOLUME'
  | 'MUTE'
  | 'UNMUTE'
  | 'LOAD_MEDIA'
  | 'NAVIGATE'
  | 'SET_SYNC_GROUP'
  | 'SET_AUDIO'
  | 'SET_SUBTITLE'
  | 'REVOKE_SESSION'
  | 'PING';

export interface UserDeviceCommand {
  id: string;
  targetDeviceId: string;
  userId: string;
  action: DeviceAction;
  payload?: any;
  createdAt: number;
}

let heartbeatTimer: any = null;
let isHeartbeating = false;

/**
 * Récupère la liste des appareils connectés au compte
 */
export async function fetchUserDevices(): Promise<{ devices: UserConnectedDevice[]; currentDeviceId: string }> {
  const user = getCurrentUser();
  if (!user) return { devices: [], currentDeviceId: getLocalDeviceId() };

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices`, {
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
      },
    });
    if (!res.ok) return { devices: [], currentDeviceId: getLocalDeviceId() };
    const data = await res.json();
    return {
      devices: data.devices || [],
      currentDeviceId: data.currentDeviceId || getLocalDeviceId(),
    };
  } catch {
    return { devices: [], currentDeviceId: getLocalDeviceId() };
  }
}

/**
 * Renomme un appareil du compte
 */
export async function renameUserDevice(deviceId: string, customName: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/${encodeURIComponent(deviceId)}/rename`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Modifie le groupe de synchronisation d'un appareil
 */
export async function setDeviceSyncGroup(deviceId: string, syncGroupId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/${encodeURIComponent(deviceId)}/sync-group`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ syncGroupId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Déconnecte à distance un appareil spécifique
 */
export async function disconnectRemoteDevice(deviceId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/${encodeURIComponent(deviceId)}/disconnect`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Déconnecte tous les autres appareils du compte (Sécurité 1-clic)
 */
export async function disconnectAllOtherDevices(): Promise<{ success: boolean; revokedCount?: number }> {
  const user = getCurrentUser();
  if (!user) return { success: false };

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/disconnect-all-others`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
      },
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    return { success: true, revokedCount: data.revokedCount };
  } catch {
    return { success: false };
  }
}

/**
 * Envoie une commande de contrôle ou de navigation à un appareil ciblé
 */
export async function sendDeviceCommand(targetDeviceId: string, action: DeviceAction, payload?: any): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/command`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetDeviceId, action, payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Diffuse un média simultanément sur plusieurs appareils en mode multi-room synchrone
 */
export async function broadcastMediaToDevices(
  targetDeviceIds: string[],
  media: {
    mediaId: string;
    title: string;
    streamUrl?: string;
    posterUrl?: string;
    positionSeconds?: number;
  },
  syncGroupId: string = 'default'
): Promise<{ success: boolean; sentCount?: number }> {
  const user = getCurrentUser();
  if (!user || !targetDeviceIds.length) return { success: false, sentCount: 0 };

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/broadcast`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetDeviceIds, media, syncGroupId }),
    });
    if (!res.ok) return { success: false, sentCount: 0 };
    const data = await res.json();
    return { success: true, sentCount: data.sentCount };
  } catch {
    return { success: false, sentCount: 0 };
  }
}

/**
 * Gestionnaire unifié de la révocation de session
 */
function handleDeviceRevocation() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  // Fermer la lecture locale immédiatement
  playerStore.closeMedia();

  // Déconnexion complète de l'utilisateur
  logout();

  if (typeof window !== 'undefined') {
    alert('Votre session a été déconnectée à distance par sécurité.');
    window.location.href = '/login';
  }
}

/**
 * Boucle de Heartbeat (présence en ligne & réception des ordres distants)
 */
export function startDeviceHeartbeatLoop(router?: any) {
  if (heartbeatTimer) return;

  const runHeartbeat = async () => {
    const user = getCurrentUser();
    if (!user || isHeartbeating) return;

    const playerState = playerStore.getState();
    const active = playerState.activeMedia;

    // Si l'onglet est en arrière-plan et qu'aucun média ne joue, économiser le réseau
    if (typeof document !== 'undefined' && document.hidden && !active?.isPlaying) {
      return;
    }

    isHeartbeating = true;
    try {
      const deviceId = getLocalDeviceId();
      const currentRoute = typeof window !== 'undefined' ? window.location.pathname : '/';
      const pageTitle = typeof document !== 'undefined' ? document.title : 'Universal Media Stack';

      const currentPlayback: DevicePlaybackState | undefined = active
        ? {
            mediaId: active.id,
            mediaTitle: active.title,
            posterUrl: active.posterUrl,
            streamUrl: active.streamUrl,
            isLive: Boolean(active.isLive),
            positionSeconds: active.positionSeconds,
            durationSeconds: active.durationSeconds,
            isPlaying: active.isPlaying,
            activeAudio: active.activeAudio,
            activeSubtitle: active.activeSubtitle,
            volume: playerState.volume,
            isMuted: playerState.isMuted,
            updatedAt: Date.now(),
          }
        : undefined;

      const res = await fetch(`${getApiBaseUrl()}/api/user/devices/heartbeat`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'X-Device-Id': deviceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          name: getLocalDeviceName(),
          deviceType: getLocalDeviceType(),
          currentRoute,
          pageTitle,
          syncGroupId: getLocalSyncGroupId(),
          currentPlayback,
        }),
      });

      if (res.status === 401) {
        const errData = await res.json().catch(() => ({}));
        if (errData?.error === 'DEVICE_REVOKED') {
          handleDeviceRevocation();
          return;
        }
      }

      if (res.ok) {
        const data = await res.json();
        const commands: UserDeviceCommand[] = data.commands || [];

        for (const cmd of commands) {
          executeRemoteCommand(cmd, router);
        }
      }
    } catch {} finally {
      isHeartbeating = false;
    }
  };

  runHeartbeat();
  heartbeatTimer = setInterval(runHeartbeat, 2500);
}

/**
 * Exécute une commande distante reçue du serveur
 */
function executeRemoteCommand(cmd: UserDeviceCommand, router?: any) {
  switch (cmd.action) {
    case 'REVOKE_SESSION':
      handleDeviceRevocation();
      break;

    case 'LOAD_MEDIA':
      if (cmd.payload?.mediaId) {
        const media = cmd.payload;
        if (cmd.payload.syncGroupId) {
          setLocalSyncGroupId(cmd.payload.syncGroupId);
        }

        const livePos = Number(media.positionSeconds) || 0;
        playerStore.openMedia({
          id: String(media.mediaId),
          title: media.title || 'Média en cours',
          posterUrl: media.posterUrl || `/api/media/${media.mediaId}/poster`,
          streamUrl: media.streamUrl || getVideoStreamUrl(media.mediaId),
          initialTime: livePos,
          isRemoteSync: true,
          expand: true,
        });

        if (livePos > 0) {
          playerStore.seekTo(livePos, false, false);
        }

        // Si nous avons un router expo et ne sommes pas sur la page lecteur
        if (router && typeof window !== 'undefined' && !window.location.pathname.includes(`/player/${media.mediaId}`)) {
          const params: any = {};
          if (media.title) params.title = media.title;
          if (livePos > 0) {
            params.joinTime = String(Math.floor(livePos));
          }
          router.push({
            pathname: `/player/${media.mediaId}`,
            params,
          } as any);
        }
      }
      break;

    case 'NAVIGATE':
      if (cmd.payload?.route && router) {
        router.push(cmd.payload.route);
      }
      break;

    case 'PLAY':
      playerStore.syncPlayingFromRemote(true);
      if (typeof window !== 'undefined') {
        const v = (document.querySelector('video[data-player-div-video="true"]') ||
          document.querySelector('video[data-video-player="true"]')) as HTMLVideoElement | null;
        if (v && v.paused) {
          const p = v.play();
          if (p !== undefined) {
            p.catch((err: any) => {
              if (err?.name === 'NotAllowedError') {
                v.muted = true;
                v.play().catch(() => {});
              }
            });
          }
        }
      }
      break;

    case 'PAUSE':
      playerStore.syncPlayingFromRemote(false);
      if (typeof window !== 'undefined') {
        const v = (document.querySelector('video[data-player-div-video="true"]') ||
          document.querySelector('video[data-video-player="true"]')) as HTMLVideoElement | null;
        if (v && !v.paused) {
          v.pause();
        }
      }
      break;

    case 'SEEK':
      if (typeof cmd.payload?.positionSeconds === 'number') {
        const targetPos = cmd.payload.positionSeconds;
        playerStore.seekTo(targetPos, false, false);
        if (typeof window !== 'undefined') {
          const v = (document.querySelector('video[data-player-div-video="true"]') ||
            document.querySelector('video[data-video-player="true"]')) as HTMLVideoElement | null;
          if (v && Number.isFinite(targetPos)) {
            v.currentTime = targetPos;
          }
        }
      }
      break;

    case 'STOP':
      playerStore.closeMedia();
      if (router) {
        router.push('/');
      }
      break;

    case 'SET_VOLUME':
      if (typeof cmd.payload?.volume === 'number') {
        playerStore.setVolume(cmd.payload.volume);
      }
      break;

    case 'MUTE':
      playerStore.setMuted(true);
      break;

    case 'UNMUTE':
      playerStore.setMuted(false);
      break;

    case 'SET_AUDIO':
      if (cmd.payload?.audio) {
        playerStore.setAudio(cmd.payload.audio);
      }
      break;

    case 'SET_SUBTITLE':
      if (cmd.payload?.subtitle) {
        playerStore.setSubtitle(cmd.payload.subtitle);
      }
      break;

    case 'SET_SYNC_GROUP':
      if (cmd.payload?.syncGroupId) {
        setLocalSyncGroupId(cmd.payload.syncGroupId);
      }
      break;

    default:
      break;
  }
}
