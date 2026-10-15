import { Platform } from 'react-native';

let deferredPrompt: any = null;

export function registerPwa(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  // 1. Initialisation du cookie d'état PWA (coordination client-serveur pour les caches)
  try {
    document.cookie = 'ums_pwa_active=1; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'ums_cache_version=1; path=/; max-age=31536000; SameSite=Lax';
  } catch {}

  // 2. Enregistrement du Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Mise à jour automatique en arrière-plan
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nouveau contenu disponible en tâche de fond
                  console.log('[UMS PWA] Nouvelle version du cache prête');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[UMS PWA] Enregistrement Service Worker ignoré:', err.message);
        });
    });
  }

  // 3. Capture de l'événement d'installation PWA
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
  });
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
