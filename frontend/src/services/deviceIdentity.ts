export type UserDeviceType = 'BROWSER' | 'MOBILE' | 'TV' | 'CHROMECAST' | 'AIRPLAY' | 'DESKTOP';

const STORAGE_DEVICE_ID = 'ums_device_id';
const STORAGE_DEVICE_NAME = 'ums_device_name';
const STORAGE_SYNC_GROUP = 'ums_sync_group_id';

/**
 * Identifiant matériel unique et persistant de l'appareil
 */
export function getLocalDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'device_srv_' + Math.random().toString(36).substring(2, 9);
  }
  let id = localStorage.getItem(STORAGE_DEVICE_ID);
  if (!id) {
    // Migration rétro-compatible si un ancien identifiant cast ou account existait
    const legacyAccount = localStorage.getItem('ums_account_device_id');
    const legacyCast = localStorage.getItem('ums_cast_device_id');
    id = legacyAccount || legacyCast || 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_DEVICE_ID, id);
    localStorage.setItem('ums_account_device_id', id);
    localStorage.setItem('ums_cast_device_id', id);
  }
  return id;
}

/**
 * Nom lisible de l'appareil local (ex: "Safari sur iPhone", "Chrome sur Linux", ou personnalisé)
 */
export function getLocalDeviceName(): string {
  if (typeof window === 'undefined' || !window.localStorage) return 'Navigateur Web';
  const custom = localStorage.getItem(STORAGE_DEVICE_NAME) || localStorage.getItem('ums_cast_device_name');
  if (custom) return custom;

  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    if (/TV|SmartTV/i.test(ua)) return 'Android TV';
    return 'Smartphone Android';
  }
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Tizen|webOS|SmartTV/i.test(ua)) return 'Télévision Connectée';
  if (/Windows/i.test(ua)) return 'PC Windows';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Navigateur Web';
}

export function setLocalDeviceName(name: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const clean = name.trim();
    localStorage.setItem(STORAGE_DEVICE_NAME, clean);
    localStorage.setItem('ums_cast_device_name', clean);
  }
}

/**
 * Détection du type d'appareil matériel
 */
export function getLocalDeviceType(): UserDeviceType {
  if (typeof window === 'undefined') return 'BROWSER';
  const ua = navigator.userAgent;
  if (/Tizen|webOS|SmartTV/i.test(ua) || (window as any).isSmartTV) return 'TV';
  if (/iPad|Tablet/i.test(ua)) return 'MOBILE';
  if (/Android|iPhone/i.test(ua)) return 'MOBILE';
  return 'BROWSER';
}

/**
 * Récupère le groupe de synchronisation actuel de cet appareil ('default', 'standalone', etc.)
 */
export function getLocalSyncGroupId(): string {
  if (typeof window === 'undefined' || !window.localStorage) return 'default';
  return localStorage.getItem(STORAGE_SYNC_GROUP) || 'default';
}

export function setLocalSyncGroupId(syncGroupId: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_SYNC_GROUP, syncGroupId.trim());
  }
}
