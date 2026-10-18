import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getCurrentUser, logout } from './authStore';
import { playerStore } from './playerStore';
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
  currentRoute: string;
  pageTitle?: string;
  syncGroupId: string;
  currentPlayback?: DevicePlaybackState;
  isOnline: boolean;
  isCurrentDevice: boolean;
}

export type DeviceAction =
  | 'LOAD_MEDIA'
  | 'NAVIGATE'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'STOP'
  | 'SET_VOLUME'
  | 'MUTE'
  | 'UNMUTE'
  | 'SET_AUDIO'
  | 'SET_SUBTITLE'
  | 'SET_SYNC_GROUP'
  | 'REVOKE_SESSION';

export interface UserDeviceCommand {
  id: string;
  targetDeviceId: string;
  userId: string;
  action: DeviceAction;
  payload?: any;
  createdAt: number;
}

/**
 * Liste tous les appareils connectés au compte de l'utilisateur
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

    if (res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      if (errData?.error === 'DEVICE_REVOKED') {
        handleDeviceRevocation();
      }
      return { devices: [], currentDeviceId: getLocalDeviceId() };
    }

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
export async function renameUserDevice(deviceId: string, name: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/rename`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId, name }),
    });
    if (deviceId === getLocalDeviceId()) {
      setLocalDeviceName(name);
    }
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Configure le groupe de synchronisation d'un appareil
 */
export async function setDeviceSyncGroup(deviceId: string, syncGroupId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/user/devices/sync-group`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId, syncGroupId }),
    });
    if (deviceId === getLocalDeviceId()) {
      setLocalSyncGroupId(syncGroupId);
    }
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
  if (!user) return { success: false };

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/playback/broadcast`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'X-Device-Id': getLocalDeviceId(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetDeviceIds,
        syncGroupId,
        ...media,
      }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    return { success: true, sentCount: data.sentCount };
  } catch {
    return { success: false };
  }
}

function handleDeviceRevocation() {
  playerStore.closeMedia();
  logout();
  if (typeof window !== 'undefined') {
    alert('Votre compte a été déconnecté à distance sur cet appareil.');
    window.location.href = '/login';
  }
}

let heartbeatTimer: any = null;
let isHeartbeating = false;

/**
 * Démarre la boucle réactive de battement de cœur et d'écoute de commandes pour cet appareil
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

        // Si nous avons un router expo et ne sommes pas sur la page lecteur
        if (router && typeof window !== 'undefined' && !window.location.pathname.includes(`/player/${media.mediaId}`)) {
          const params: any = {};
          if (media.title) params.title = media.title;
          if (media.positionSeconds && media.positionSeconds > 0) {
            params.joinTime = String(Math.floor(media.positionSeconds));
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
      break;

    case 'PAUSE':
      playerStore.syncPlayingFromRemote(false);
      break;

    case 'SEEK':
      if (typeof cmd.payload?.positionSeconds === 'number') {
        playerStore.seekTo(cmd.payload.positionSeconds, false);
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
  }
}
