import { useState, useEffect } from 'react';
import { getApiBaseUrl } from './apiConfig';
import { clearMemoryCache } from './pwaDataCache';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  isIncognito?: boolean;
  canDownload: boolean;
  canTranscode: boolean;
  canWatchIptv: boolean;
  maxCsaAgeLimit?: number | null;
}

export interface AuthStatus {
  hasUsers: boolean;
  hasAdmin: boolean;
  userCount?: number;
  adminCount?: number;
  siteName: string;
  registrationOpen: boolean;
  invitationOnly?: boolean;
}

const STORAGE_KEY = 'ums_auth_session_v2';
let memoryUser: UserProfile | null = null;
let memoryToken: string | null = null;
const listeners = new Set<(u: UserProfile | null) => void>();

export function purgeAllMediaCaches(): void {
  // Purge de la mémoire vive instantanée
  clearMemoryCache();

  // Purge du LocalStorage persistant
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('ums_cache_') ||
            k.startsWith('tax_') ||
            k.startsWith('home_layout') ||
            k.startsWith('media_detail_') ||
            k.startsWith('media_stats_'))
        ) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
  }
}

if (typeof window !== 'undefined') {
  try {
    if (window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryUser = parsed.user || null;
        memoryToken = parsed.token || null;
      }
    }

    // Récupération prioritaire d'un jeton d'invitation directe ou de redirection (?token=... ou ?auth_token=...)
    if (window.location && window.location.search) {
      const sp = new URLSearchParams(window.location.search);
      const queryToken = sp.get('token') || sp.get('auth_token');
      if (queryToken && queryToken.trim().length > 0) {
        memoryToken = queryToken.trim();
        // Nettoyage esthétique de la barre d'adresse sans recharger la page
        const cleanUrl = window.location.pathname + (window.location.hash || '');
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  } catch {}
}

function notify() {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (memoryUser && memoryToken) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: memoryUser, token: memoryToken }));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  listeners.forEach((fn) => fn(memoryUser));
}

export function getCurrentUser(): UserProfile | null { return memoryUser; }
export function getAuthToken(): string | null { return memoryToken; }

export function setAuthSession(user: UserProfile, token: string): void {
  memoryUser = user;
  memoryToken = token;
  purgeAllMediaCaches();
  notify();
}

export function updateCurrentUser(partial: Partial<UserProfile>): void {
  if (memoryUser) {
    memoryUser = { ...memoryUser, ...partial };
    notify();
  }
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (memoryToken) headers['Authorization'] = `Bearer ${memoryToken}`;
  if (memoryUser?.id) headers['X-User-Id'] = memoryUser.id;
  return headers;
}

export function logout(): void {
  memoryUser = null;
  memoryToken = null;
  purgeAllMediaCaches();
  notify();
}

/**
 * Synchronise immédiatement la session locale avec le serveur PostgreSQL (/api/auth/me)
 * Garantit que les privilèges (notamment isAdmin, isIncognito) sont à jour sans forcer une reconnexion
 */
export async function syncSessionWithServer(): Promise<UserProfile | null> {
  if (!memoryToken) return null;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${memoryToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        memoryUser = data.user;
        notify();
        return memoryUser;
      }
    }
  } catch {}
  return memoryUser;
}

// Déclenche la synchronisation en arrière-plan dès le chargement du bundle client
if (typeof window !== 'undefined' && memoryToken) {
  syncSessionWithServer().catch(() => {});
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/status`);
    if (!res.ok) throw new Error('Erreur statut auth');
    const data = await res.json();
    return {
      hasUsers: Boolean(data.hasUsers),
      hasAdmin: Boolean(data.hasAdmin ?? data.hasUsers),
      userCount: typeof data.userCount === 'number' ? data.userCount : undefined,
      adminCount: typeof data.adminCount === 'number' ? data.adminCount : undefined,
      siteName: data.siteName || 'Universal Media Stack',
      registrationOpen: Boolean(data.registrationOpen),
      invitationOnly: Boolean(data.invitationOnly),
    };
  } catch {
    return {
      hasUsers: true,
      hasAdmin: true,
      siteName: 'Universal Media Stack',
      registrationOpen: true,
      invitationOnly: false,
    };
  }
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Email ou mot de passe incorrect' };
    }
    memoryUser = data.user;
    memoryToken = data.token;
    purgeAllMediaCaches();
    notify();
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau lors de la connexion' };
  }
}

export async function registerAccount(
  email: string,
  password: string,
  displayName: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, displayName: displayName.trim() }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Erreur lors de la création du compte' };
    }
    memoryUser = data.user;
    memoryToken = data.token;
    purgeAllMediaCaches();
    notify();
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau lors de la création' };
  }
}

export function useCurrentUser(): UserProfile | null {
  const [user, setUser] = useState<UserProfile | null>(memoryUser);
  useEffect(() => {
    setUser(memoryUser);
    const listener = (u: UserProfile | null) => setUser(u);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return user;
}
