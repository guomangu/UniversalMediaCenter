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
}

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

export async function fetchCastDevices(): Promise<CastDevice[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/devices`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.devices || [];
  } catch {
    return [];
  }
}

export async function registerAsReceiver(
  name: string,
  state: { isPlaying: boolean; positionSeconds: number; durationSeconds: number }
): Promise<void> {
  const id = getLocalDeviceId();
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, deviceType: 'BROWSER', ...state }),
    });
  } catch (err) {
    console.warn('Cast registration error:', err);
  }
}

export async function sendCastCommand(
  targetDeviceId: string,
  action: 'LOAD' | 'PLAY' | 'PAUSE' | 'SEEK' | 'STOP',
  payload?: any
): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDeviceId, action, payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pollDeviceCommands(
  deviceId: string,
  onCommand: (cmd: any) => void
): Promise<void> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/poll/${deviceId}`);
    if (res.ok) {
      const data = await res.json();
      for (const cmd of data.commands || []) {
        onCommand(cmd);
      }
    }
  } catch {}
}
