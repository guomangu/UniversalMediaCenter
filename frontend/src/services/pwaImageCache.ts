import { Platform } from 'react-native';

const IMAGE_CACHE_NAME = 'ums-images-cache-v1';
const cachedImageUrls = new Set<string>();

export async function isImageCached(url?: string | null): Promise<boolean> {
  if (!url || Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  if (cachedImageUrls.has(url)) return true;
  if ('caches' in window) {
    try {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      const match = await cache.match(url);
      if (match) {
        cachedImageUrls.add(url);
        return true;
      }
    } catch {}
  }
  return false;
}

export async function prefetchImageToCache(url?: string | null): Promise<void> {
  if (!url || Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  if (cachedImageUrls.has(url)) return;
  cachedImageUrls.add(url);

  // 1. Pré-chargement natif HTML Image : Zéro blocage CORS et mise en cache mémoire/disque immédiate
  try {
    const img = new Image();
    img.src = url;
  } catch {}

  // 2. Persistance dans l'API CacheStorage PWA
  if ('caches' in window) {
    try {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      const existing = await cache.match(url);
      if (!existing) {
        // En mode no-cors ou standard, pour éviter toute erreur de redirection
        const res = await fetch(url).catch(() => null);
        if (res && (res.status === 200 || res.type === 'opaque')) {
          await cache.put(url, res.clone());
        }
      }
      syncImageCookieCount();
    } catch {}
  }
}

export async function prefetchImages(urls: (string | null | undefined)[]): Promise<void> {
  const valid = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
  // Limiter le parallélisme pour ne pas saturer le pool de connexions du navigateur
  const batchSize = 6;
  for (let i = 0; i < valid.length; i += batchSize) {
    const batch = valid.slice(i, i + batchSize);
    await Promise.allSettled(batch.map((u) => prefetchImageToCache(u)));
  }
}

function syncImageCookieCount(): void {
  try {
    if (typeof document !== 'undefined') {
      const count = Math.min(cachedImageUrls.size, 9999);
      document.cookie = `ums_img_cached_count=${count}; path=/; max-age=86400; SameSite=Lax`;
    }
  } catch {}
}
