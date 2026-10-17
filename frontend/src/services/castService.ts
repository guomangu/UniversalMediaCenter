import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from './authStore';

export type DeviceType = 'TV' | 'CHROMECAST' | 'AIRPLAY' | 'BROWSER' | 'MOBILE';

export interface CastDevice {
  id: string;
  name: string;
  deviceType: DeviceType;
  currentMediaId?: string;
  mediaTitle?: string;
  posterUrl?: string;
  positionSeconds?: number;
  durationSeconds?: number;
  isPlaying?: boolean;
  volume?: number;
  isMuted?: boolean;
  audioTrack?: string;
  subtitleTrack?: string;
  lastSeen?: string;
}

export interface CastMediaPayload {
  id: string;
  title: string;
  streamUrl?: string;
  posterUrl?: string;
  positionSeconds?: number;
}

export type CastAction =
  | 'LOAD'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'STOP'
  | 'SET_VOLUME'
  | 'MUTE'
  | 'UNMUTE'
  | 'SET_AUDIO'
  | 'SET_SUBTITLE';

export function getLocalDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('ums_cast_device_id');
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('ums_cast_device_id', id);
  }
  return id;
}

export function getLocalDeviceName(): string {
  if (typeof window === 'undefined') return 'Appareil Web';
  const custom = localStorage.getItem('ums_cast_device_name');
  if (custom) return custom;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Mobile Android';
  if (/iPhone|iPad/i.test(ua)) return 'Appareil Apple';
  if (/Tizen|webOS|SmartTV/i.test(ua)) return 'Télévision Connectée';
  if (/Windows/i.test(ua)) return 'PC Windows';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Navigateur Web';
}

export function setLocalDeviceName(name: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('ums_cast_device_name', name);
  }
}

export async function fetchCastServerInfo(): Promise<{ lanIp: string; port: number; gatewayPort: number } | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/info`).catch(() => null);
    if (!res || !res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function fetchCastDevices(): Promise<CastDevice[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/devices`).catch(() => null);
    if (!res || !res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.devices || []).filter((d: CastDevice) => d.id !== getLocalDeviceId());
  } catch {
    return [];
  }
}

export async function fetchDeviceStatus(deviceId: string): Promise<CastDevice | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/device/${deviceId}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.device || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Initialise le framework Google Cast officiel du navigateur
 */
export function initGoogleCastFramework(): void {
  if (typeof window === 'undefined') return;

  const configureContext = () => {
    try {
      if ((window as any).cast?.framework && (window as any).chrome?.cast) {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        castContext.setOptions({
          receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped',
        });
      }
    } catch (e) {
      console.warn('Google Cast init error:', e);
    }
  };

  (window as any)['__onGCastApiAvailable'] = (isAvailable: boolean) => {
    if (isAvailable) {
      configureContext();
    }
  };

  if ((window as any).cast?.framework) {
    configureContext();
  }
}

/**
 * Résout une URL de flux lisible par un Chromecast ou une Smart TV externe
 * Remplace localhost par l'IP LAN et ajoute le jeton d'authentification si requis
 */
export async function resolveLanStreamUrl(rawUrl?: string, mediaId?: string): Promise<string> {
  let url = rawUrl;
  if (!url && mediaId) {
    url = `${getApiBaseUrl()}/api/media/${mediaId}/stream`;
  }
  if (!url) return '';

  const serverInfo = await fetchCastServerInfo();
  const lanIp = serverInfo?.lanIp || '192.168.1.93';

  // Si l'URL pointe vers localhost ou 127.0.0.1, substituer par l'IP LAN accessible du serveur
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    url = url.replace(/localhost|127\.0\.0\.1/g, lanIp);
  }

  // Si l'URL est relative
  if (url.startsWith('/')) {
    const port = serverInfo?.gatewayPort || 8080;
    url = `http://${lanIp}:${port}${url}`;
  }

  // Joindre le jeton d'authentification pour que le Chromecast puisse lire le flux sans cookies
  const token = getAuthToken();
  if (token && !url.includes('token=') && !url.includes('share=')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}token=${encodeURIComponent(token)}`;
  }

  return url;
}

export interface NativeCastResult {
  success: boolean;
  message?: string;
  target?: 'GOOGLE_CAST' | 'REMOTE_PLAYBACK' | 'AIRPLAY' | 'NONE';
}

/**
 * Déclenche le Cast natif (Google Cast / Chromecast, AirPlay, ou HTML5 Remote Playback)
 */
export async function triggerNativeCast(media?: CastMediaPayload): Promise<NativeCastResult> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Non supporté hors environnement web' };
  }

  const cast = (window as any).cast;
  const chrome = (window as any).chrome;

  // Résolution de l'URL LAN certifiée
  const lanStreamUrl = await resolveLanStreamUrl(media?.streamUrl, media?.id);

  // 1. Google Cast SDK officiel (Chromecast, Google TV, Android TV)
  if (cast?.framework && chrome?.cast) {
    try {
      const instance = cast.framework.CastContext.getInstance();
      await instance.requestSession();
      const session = instance.getCurrentSession();
      if (session && media) {
        const contentType = lanStreamUrl.includes('.m3u8') ? 'application/x-mpegurl' : 'video/mp4';
        const mediaInfo = new chrome.cast.media.MediaInfo(lanStreamUrl, contentType);
        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = media.title;
        if (media.posterUrl) {
          mediaInfo.metadata.images = [{ url: media.posterUrl }];
        }
        const request = new chrome.cast.media.LoadRequest(mediaInfo);
        if (media.positionSeconds && media.positionSeconds > 0) {
          request.currentTime = media.positionSeconds;
        }
        await session.loadMedia(request);
        return { success: true, target: 'GOOGLE_CAST', message: 'Connecté via Google Cast' };
      }
    } catch (err: any) {
      if (err?.code !== 'cancel') {
        console.warn('Google Cast requestSession notice:', err);
      }
    }
  }

  // 2. AirPlay natif pour Safari / Apple WebKit
  const video = (document.querySelector('video[data-video-player="true"]') ||
    document.querySelector('video')) as any;

  if (video && typeof video.webkitShowPlaybackTargetPicker === 'function') {
    try {
      video.webkitShowPlaybackTargetPicker();
      return { success: true, target: 'AIRPLAY', message: 'Sélecteur AirPlay ouvert' };
    } catch (err) {
      console.warn('AirPlay picker notice:', err);
    }
  }

  // 3. HTML5 Remote Playback API standard (Chromecast & écrans sans fil du navigateur)
  if (video?.remote && typeof video.remote.prompt === 'function') {
    try {
      await video.remote.prompt();
      return { success: true, target: 'REMOTE_PLAYBACK', message: 'Sélecteur d’écrans sans fil ouvert' };
    } catch (err: any) {
      if (err?.name !== 'NotFoundError' && err?.name !== 'NotAllowedError') {
        console.warn('Remote Playback notice:', err);
      }
    }
  }

  // 4. W3C Presentation API
  if ((window as any).PresentationRequest) {
    try {
      const pReq = new (window as any).PresentationRequest(['https://www.google.com/chromecast']);
      await pReq.start();
      return { success: true, target: 'GOOGLE_CAST', message: 'Diffusion lancée' };
    } catch {}
  }

  return {
    success: false,
    target: 'NONE',
    message: 'Aucun récepteur Google Cast ou AirPlay actif détecté. Vérifiez que votre TV est allumée sur le même réseau Wi-Fi.',
  };
}

export async function registerAsReceiver(name: string, state: Partial<CastDevice>): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getLocalDeviceId(), name, deviceType: 'BROWSER', ...state }),
    }).catch(() => null);
  } catch {}
}

export async function sendCastHeartbeat(state: Partial<CastDevice>): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getLocalDeviceId(), ...state }),
    }).catch(() => null);
  } catch {}
}

export async function sendCastCommand(targetDeviceId: string, action: CastAction, payload?: any): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDeviceId, action, payload }),
    }).catch(() => null);
    return Boolean(res && res.ok);
  } catch {
    return false;
  }
}

export async function pollDeviceCommands(deviceId: string, onCommand: (cmd: any) => void): Promise<void> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/poll/${deviceId}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.commands && Array.isArray(data.commands)) {
        for (const cmd of data.commands) onCommand(cmd);
      }
    }
  } catch {}
}
