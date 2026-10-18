import { Platform } from 'react-native';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryStore = new Map<string, CacheEntry<any>>();
const CACHE_PREFIX = 'ums_cache_';
const DEFAULT_STALE_TIME = 1000 * 60 * 5; // 5 minutes de fraîcheur active (zéro appel réseau)
const DEFAULT_TTL = 1000 * 60 * 60 * 24; // 24 heures de rétention persistante

export function getCachedData<T>(key: string): T | null {
  const fullKey = CACHE_PREFIX + key;
  // 1. Niveau 1 : Mémoire vive ultra-rapide (0 ms absolu)
  const mem = memoryStore.get(fullKey);
  if (mem) return mem.data;

  // 2. Niveau 2 : LocalStorage persistant
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        // Expiration dure (TTL)
        if (Date.now() - parsed.timestamp > (parsed.ttl || DEFAULT_TTL)) {
          localStorage.removeItem(fullKey);
          return null;
        }
        memoryStore.set(fullKey, parsed);
        return parsed.data;
      }
    } catch {}
  }
  return null;
}

export function setCachedData<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  if (data === undefined || data === null) return;
  const fullKey = CACHE_PREFIX + key;
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
  memoryStore.set(fullKey, entry);

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch {}
  }
}

export function clearMemoryCache(): void {
  memoryStore.clear();
}

export function invalidateCache(key: string): void {
  const fullKey = CACHE_PREFIX + key;
  memoryStore.delete(fullKey);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(fullKey);
    } catch {}
  }
}

export function invalidateCacheByPrefix(prefix: string): void {
  const fullPrefix = CACHE_PREFIX + prefix;
  for (const k of Array.from(memoryStore.keys())) {
    if (k.startsWith(fullPrefix)) {
      memoryStore.delete(k);
    }
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {}
  }
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttl?: number;
    staleTime?: number;
    forceRefresh?: boolean;
    onFreshData?: (fresh: T) => void;
  }
): Promise<T> {
  const fullKey = CACHE_PREFIX + key;
  let entry = memoryStore.get(fullKey);
  if (!entry) {
    // Si absent de la RAM vive, hydrater depuis le stockage persistant LocalStorage
    getCachedData<T>(key);
    entry = memoryStore.get(fullKey);
  }
  const cached = entry ? entry.data : null;
  const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
  const ttl = options?.ttl ?? DEFAULT_TTL;

  const isFresh = entry && !options?.forceRefresh && Date.now() - entry.timestamp < staleTime;

  // MODE SMART : Si la donnée est encore fraîche en mémoire, zéro requête réseau !
  if (cached !== null && isFresh) {
    return cached;
  }

  // Tâche de fond asynchrone (Stale-While-Revalidate)
  const networkPromise = fetcher()
    .then((fresh) => {
      if (fresh !== null && fresh !== undefined) {
        setCachedData(key, fresh, ttl);
        if (cached !== null && options?.onFreshData) {
          options.onFreshData(fresh);
        }
      }
      return fresh;
    })
    .catch((err) => {
      if (cached !== null) return cached;
      throw err;
    });

  // Si du contenu est déjà en mémoire, le restituer immédiatement (0 ms)
  if (cached !== null) {
    return cached;
  }

  return networkPromise;
}

export function isOnline(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
}
