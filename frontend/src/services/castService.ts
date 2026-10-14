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
  audioTrack?: string;
  subtitleTrack?: string;
  lastSeenAt?: number;
}

export type CastAction = 'LOAD' | 'PLAY' | 'PAUSE' | 'SEEK' | 'STOP' | 'SET_VOLUME' | 'MUTE' | 'UNMUTE' | 'SET_AUDIO' | 'SET_SUBTITLE';

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

export async function fetchCastDevices(): Promise<CastDevice[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/devices`);
    return res.ok ? ((await res.json()).devices || []) : [];
  } catch { return []; }
}

export async function fetchDeviceStatus(deviceId: string): Promise<CastDevice | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/device/${deviceId}`);
    return res.ok ? ((await res.json()).device || null) : null;
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

export async function sendCastHeartbeat(updates: Partial<CastDevice>): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getLocalDeviceId(), ...updates }),
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
