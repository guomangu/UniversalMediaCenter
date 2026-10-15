import { Platform } from 'react-native';

const TAB_STATE_PREFIX = 'ums_tab_state_';
const memoryTabStates = new Map<string, any>();

export function getTabState<T>(screenId: string, fallback: T): T {
  const fullKey = TAB_STATE_PREFIX + screenId;
  // 1. Mémoire vive
  if (memoryTabStates.has(fullKey)) {
    return memoryTabStates.get(fullKey) as T;
  }

  // 2. SessionStorage persistant du navigateur
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const saved = sessionStorage.getItem(fullKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        memoryTabStates.set(fullKey, parsed);
        return parsed as T;
      }
    } catch {}
  }

  return fallback;
}

export function setTabState<T>(screenId: string, value: T): void {
  const fullKey = TAB_STATE_PREFIX + screenId;
  memoryTabStates.set(fullKey, value);

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(value));
    } catch {}
  }
}

export function updateTabPartialState<T extends object>(screenId: string, partial: Partial<T>, fallback: T): T {
  const current = getTabState<T>(screenId, fallback);
  const updated = { ...current, ...partial };
  setTabState<T>(screenId, updated);
  return updated;
}

export function clearTabState(screenId?: string): void {
  if (screenId) {
    const fullKey = TAB_STATE_PREFIX + screenId;
    memoryTabStates.delete(fullKey);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(fullKey);
    }
  } else {
    memoryTabStates.clear();
  }
}
