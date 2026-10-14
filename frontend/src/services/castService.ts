import { getApiBaseUrl } from './apiConfig';

export interface CastDevice {
  id: string;
  name: string;
  deviceType: 'TV' | 'BROWSER' | 'MOBILE' | 'CHROMECAST' | 'AIRPLAY';
  currentMediaId?: string;
  mediaTitle?: string;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  volume?: number;
  isMuted?: boolean;
}

export type CastAction = 'LOAD' | 'PLAY' | 'PAUSE' | 'SEEK' | 'STOP' | 'SET_VOLUME' | 'MUTE' | 'UNMUTE';

export function getLocalDeviceId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    let id = localStorage.getItem('ums_cast_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('ums_cast_device_id', id);
    }
    return id;
  }
  return 'device-default';
}

export function getLocalDeviceName(): string {
  return (typeof window !== 'undefined' && window.localStorage?.getItem('ums_cast_device_name')) || 'Écran UMS';
}

export function setLocalDeviceName(name: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('ums_cast_device_name', name);
  }
}

/**
 * Déclenche le Cast natif professionnel (Remote Playback API W3C & Google Cast SDK)
 * Détecte immédiatement la télévision comme sur YouTube
 */
export async function triggerNativeCast(videoElement?: any): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. API standard W3C Remote Playback (Chrome, Edge, Samsung Internet, Android)
  const video =
    videoElement ||
    (document.querySelector('video[data-video-player="true"]') as any) ||
    document.querySelector('video');

  if (video && video.remote && typeof video.remote.prompt === 'function') {
    try {
      await video.remote.prompt();
      return true;
    } catch (e) {
      console.log('Remote Playback prompt:', e);
    }
  }

  // 2. Google Cast Framework SDK
  const cast = (window as any).cast;
  const chrome = (window as any).chrome;
  if (cast?.framework && chrome?.cast) {
    try {
      const context = cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      await context.requestSession();
      return true;
    } catch (e) {
      console.log('Cast requestSession error:', e);
    }
  }

  // 3. W3C Presentation API
  if ((window as any).PresentationRequest) {
    try {
      const pReq = new (window as any).PresentationRequest(['https://www.google.com/chromecast']);
      await pReq.start();
      return true;
    } catch (e) {
      console.log('Presentation API error:', e);
    }
  }

  return false;
}

export async function fetchCastDevices(): Promise<CastDevice[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/devices`);
    return res.ok ? ((await res.json()).devices || []) : [];
  } catch { return []; }
}

export async function fetchDeviceStatus(deviceId: string): Promise<CastDevice | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/device/${deviceId}`);
    if (res.ok) {
      const data = await res.json();
      return data.device || null;
    }
    return null;
  } catch { return null; }
}

export async function registerAsReceiver(name: string, state: Partial<CastDevice>): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getLocalDeviceId(), name, deviceType: 'BROWSER', ...state }),
    });
  } catch {}
}

export async function sendCastHeartbeat(state: Partial<CastDevice>): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getLocalDeviceId(), ...state }),
    });
  } catch {}
}

export async function sendCastCommand(targetDeviceId: string, action: CastAction, payload?: any): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDeviceId, action, payload }),
    });
    return res.ok;
  } catch { return false; }
}

export async function pollDeviceCommands(deviceId: string, onCommand: (cmd: any) => void): Promise<void> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/poll/${deviceId}`);
    if (res.ok) {
      const data = await res.json();
      for (const cmd of data.commands || []) onCommand(cmd);
    }
  } catch {}
}
