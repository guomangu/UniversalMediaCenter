import { Platform } from 'react-native';

let deferredPrompt: any = null;

export function registerPwa(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  // 1. Initialisation du cookie d'état PWA
  try {
    document.cookie = 'ums_pwa_active=1; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'ums_cache_version=3; path=/; max-age=31536000; SameSite=Lax';
  } catch {}

  // 2. Nettoyage proactif des caches obsolètes.
  // ⚠️ Ne jamais supprimer les caches courants `ums-images-cache-v1` et
  // `ums-data-cache-v1` : ils portent le suffixe v1 mais sont bien la version
  // active. L'ancien filtre `includes('v1')` vidait tout le cache hors-ligne
  // à chaque démarrage.
  if ('caches' in window) {
    const currentCaches = new Set([
      'ums-static-ums-pwa-v3',
      'ums-images-cache-v1',
      'ums-data-cache-v1',
    ]);
    window.caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key.startsWith('ums-') && !currentCaches.has(key)) {
          window.caches.delete(key).catch(() => {});
        }
      });
    }).catch(() => {});
  }

  // 3. Enregistrement et mise à jour forcée immédiate du Service Worker
  if ('serviceWorker' in navigator) {
    const doRegister = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Forcer la vérification d'une nouvelle version immédiatement
          reg.update().catch(() => {});

          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[UMS PWA] Nouvelle version du Service Worker prête');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[UMS PWA] Enregistrement Service Worker ignoré:', err.message);
        });
    };

    if (document.readyState === 'complete') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }
  }

  // 4. Capture de l'événement d'installation PWA
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export async function clearAllLocalCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.localStorage) {
      const keysToKeep = ['ums_auth_session_v2'];
      const preserved: Record<string, string> = {};
      keysToKeep.forEach((k) => {
        const val = localStorage.getItem(k);
        if (val) preserved[k] = val;
      });
      localStorage.clear();
      Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));
    }
  } catch {}
}

export function canInstallPwa(): boolean {
  return !!deferredPrompt;
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome === 'accepted';
}
