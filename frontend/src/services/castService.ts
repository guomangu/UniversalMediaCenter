import { getApiBaseUrl } from './apiConfig';

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

  (window as any)['__onGCastApiAvailable'] = (isAvailable: boolean) => {
    if (isAvailable && (window as any).cast?.framework) {
      try {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        castContext.setOptions({
          receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped',
        });
      } catch (e) {
        console.warn('Google Cast init error:', e);
      }
    }
  };
}

/**
 * Déclenche le Cast natif (Google Cast / Chromecast ou HTML5 Remote Playback / AirPlay)
 */
export async function triggerNativeCast(media?: CastMediaPayload): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const cast = (window as any).cast;
  const chrome = (window as any).chrome;

  // 1. Google Cast SDK
  if (cast?.framework && chrome?.cast) {
    try {
      const instance = cast.framework.CastContext.getInstance();
      await instance.requestSession();
      const session = instance.getCurrentSession();
      if (session && media) {
        const streamUrl = media.streamUrl || `${getApiBaseUrl()}/api/media/${media.id}/stream`;
        const contentType = streamUrl.includes('.m3u8') ? 'application/x-mpegurl' : 'video/mp4';
        const mediaInfo = new chrome.cast.media.MediaInfo(streamUrl, contentType);
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
      }
      return true;
    } catch (err) {
      console.warn('Google Cast requestSession:', err);
    }
  }

  // 2. HTML5 Remote Playback API (Chromecast/AirPlay natif du lecteur vidéo)
  const video = (document.querySelector('video[data-video-player="true"]') ||
    document.querySelector('video')) as any;
  if (video?.remote && typeof video.remote.prompt === 'function') {
    try {
      await video.remote.prompt();
      return true;
    } catch (err) {
      console.warn('Remote Playback error:', err);
    }
  }

  // 3. W3C Presentation API
  if ((window as any).PresentationRequest) {
    try {
      const pReq = new (window as any).PresentationRequest(['https://www.google.com/chromecast']);
      await pReq.start();
      return true;
    } catch {}
  }

  return false;
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
