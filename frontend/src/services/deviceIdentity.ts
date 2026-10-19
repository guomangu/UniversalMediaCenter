export type UserDeviceType = 'BROWSER' | 'MOBILE' | 'TV' | 'CHROMECAST' | 'AIRPLAY' | 'DESKTOP';

const STORAGE_DEVICE_ID = 'ums_device_id';
const STORAGE_DEVICE_NAME = 'ums_device_name';
const STORAGE_SYNC_GROUP = 'ums_sync_group_id';
const STORAGE_TAB_SESSION_ID = 'ums_tab_session_id';

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
 * Identifiant de session de lecture unique pour cette instance/onglet.
 * Garantit que deux onglets du même navigateur ont des identifiants distincts
 * afin d'éliminer les collisions multi-maîtres et de synchroniser parfaitement les deux fenêtres.
 */
export function getLocalPlaybackDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'device_srv_' + Math.random().toString(36).substring(2, 9);
  }
  try {
    let tabId = sessionStorage.getItem(STORAGE_TAB_SESSION_ID);
    if (!tabId) {
      tabId = 'tab_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem(STORAGE_TAB_SESSION_ID, tabId);
    }
    const baseId = getLocalDeviceId();
    return `${baseId}_${tabId}`;
  } catch {
    return getLocalDeviceId();
  }
}

/**
 * Nom lisible de l'appareil local (ex: "Safari sur iPhone", "Chrome sur Linux", ou personnalisé)
 */
export function getLocalDeviceName(): string {
  if (typeof window === 'undefined' || !window.localStorage) return 'Navigateur Web';
  const custom = localStorage.getItem(STORAGE_DEVICE_NAME) || localStorage.getItem('ums_cast_device_name');
  if (custom && custom.trim()) return custom.trim();

  const ua = navigator.userAgent;
  let browser = 'Navigateur';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';

  if (/Tizen/i.test(ua)) return 'Samsung Smart TV (Tizen)';
  if (/webOS/i.test(ua)) return 'LG Smart TV (webOS)';
  if (/Android/i.test(ua)) {
    if (/TV|SmartTV/i.test(ua)) return 'Android TV';
    const m = ua.match(/Android [^;]+;\s*([^;)]+)\)/i);
    const model = m && m[1] ? m[1].replace(/Build\/.*/i, '').trim() : '';
    return model ? `${model} (${browser})` : `${browser} (Android)`;
  }
  if (/iPhone/i.test(ua)) return `iPhone (${browser})`;
  if (/iPad/i.test(ua)) return `iPad (${browser})`;
  if (/SmartTV/i.test(ua)) return 'Smart TV';
  if (/Windows/i.test(ua)) return `${browser} (Windows)`;
  if (/Macintosh|Mac OS/i.test(ua)) return `${browser} (macOS)`;
  if (/Linux/i.test(ua)) return `${browser} (Linux)`;
  return `${browser} Web`;
}

/**
 * Récupère le vrai nom lisible et l'icône d'un appareil à partir de ses métadonnées
 */
export function getRealDeviceDisplayName(dev: {
  name?: string;
  customName?: string;
  userAgent?: string;
  deviceType?: string;
  clientInfo?: string;
}): { title: string; subtitle: string; icon: string } {
  const ua = dev.userAgent || '';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let defaultTitle = '';
  let icon = '💻';

  if (/Tizen/i.test(ua)) {
    defaultTitle = 'Samsung Smart TV (Tizen)';
    icon = '📺';
  } else if (/webOS/i.test(ua)) {
    defaultTitle = 'LG Smart TV (webOS)';
    icon = '📺';
  } else if (/Android/i.test(ua)) {
    if (/TV|SmartTV/i.test(ua)) {
      defaultTitle = 'Android TV';
      icon = '📺';
    } else {
      const m = ua.match(/Android [^;]+;\s*([^;)]+)\)/i);
      const model = m && m[1] ? m[1].replace(/Build\/.*/i, '').trim() : '';
      defaultTitle = model ? `${model} (${browser || 'Android'})` : (browser ? `${browser} (Android)` : 'Smartphone Android');
      icon = '📱';
    }
  } else if (/iPhone/i.test(ua)) {
    defaultTitle = browser ? `iPhone (${browser})` : 'iPhone';
    icon = '📱';
  } else if (/iPad/i.test(ua)) {
    defaultTitle = browser ? `iPad (${browser})` : 'iPad';
    icon = '📱';
  } else if (/Windows/i.test(ua)) {
    defaultTitle = browser ? `${browser} (Windows)` : 'PC Windows';
    icon = '💻';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    defaultTitle = browser ? `${browser} (macOS)` : 'Mac';
    icon = '💻';
  } else if (/Linux/i.test(ua)) {
    defaultTitle = browser ? `${browser} (Linux)` : 'Linux';
    icon = '💻';
  } else if (dev.deviceType === 'TV' || dev.deviceType === 'CHROMECAST') {
    defaultTitle = dev.name || 'Google Chromecast / Smart TV';
    icon = '📺';
  } else if (dev.deviceType === 'AIRPLAY') {
    defaultTitle = dev.name || 'Apple TV / AirPlay';
    icon = '📺';
  } else {
    defaultTitle = dev.name || (browser ? `${browser} Web` : 'Écran Connecté');
    icon = '🖥️';
  }

  if (dev.customName && dev.customName.trim()) {
    return {
      title: dev.customName.trim(),
      subtitle: defaultTitle,
      icon,
    };
  }

  const rawName = (dev.name || '').trim();
  const isGeneric = !rawName || rawName === 'Navigateur Web' || rawName === 'Appareil Connecté' || rawName === 'Appareil révoqué';

  return {
    title: isGeneric ? defaultTitle : rawName,
    subtitle: isGeneric ? (dev.clientInfo || 'Écran UMS') : defaultTitle,
    icon,
  };
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
  if (typeof window === 'undefined' || !window.localStorage) return 'standalone';
  return localStorage.getItem(STORAGE_SYNC_GROUP) || 'standalone';
}

export function setLocalSyncGroupId(syncGroupId: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_SYNC_GROUP, syncGroupId.trim());
  }
}
