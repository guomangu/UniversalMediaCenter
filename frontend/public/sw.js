/**
 * The Universal Media Stack - Service Worker PWA
 * Gestion du cache hors-ligne et optimisation ultra-rapide des images & données
 */

const CACHE_VERSION = 'ums-pwa-v3';
const STATIC_CACHE = `ums-static-${CACHE_VERSION}`;
const IMAGE_CACHE = 'ums-images-cache-v1';
const DATA_CACHE = 'ums-data-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![STATIC_CACHE, IMAGE_CACHE, DATA_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isImageRequest(request) {
  const url = request.url;
  return (
    request.destination === 'image' ||
    url.includes('/poster') ||
    url.includes('/fanart') ||
    url.includes('/thumb') ||
    url.includes('/artworks/') ||
    url.includes('/avatar') ||
    /\.(png|jpe?g|webp|avif|gif|svg)(\?.*)?$/i.test(url)
  );
}

function isLiveOrStreamRequest(url) {
  return (
    url.includes('/stream') ||
    url.includes('/hls') ||
    url.includes('/cast') ||
    url.includes('/progress') ||
    url.includes('/sessions') ||
    url.includes('/playback') ||
    /\.(m3u8|ts|mpd|m4s|mp4|webm)(\?.*)?$/i.test(url)
  );
}

function isCacheableApiRequest(request) {
  const url = request.url;
  if (request.method !== 'GET') return false;
  // Exclure strictement tous les flux live, segments vidéo, sessions et progressions
  if (isLiveOrStreamRequest(url)) return false;
  if (url.includes('/api/user/') || url.includes('/api/auth/')) return false;
  return url.includes('/api/ui/') || url.includes('/api/media/') || url.includes('/api/iptv/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // 0. Bypasser immédiatement et totalement le cache pour tous les flux streaming et pings
  if (isLiveOrStreamRequest(url)) {
    return;
  }

  // 1. Gestion des images : Cache-First agressif et tolérant opaque/cross-origin
  if (isImageRequest(request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && (res.status === 200 || res.type === 'opaque')) {
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          return cached || fetch(request).catch(() => new Response('', { status: 404 }));
        }
      })
    );
    return;
  }

  // 2. Gestion des requêtes API : Stale-While-Revalidate transparent
  if (isCacheableApiRequest(request)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              cache.put(request, res.clone());
            }
            return res;
          })
          .catch(() => cached);

        return cached || networkPromise;
      })
    );
    return;
  }

  // 3. Navigation HTML : Network-First avec fallback vers le shell mis en cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
  }
});
