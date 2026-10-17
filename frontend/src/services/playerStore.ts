import { useState, useEffect } from 'react';
import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getAuthToken } from './authStore';
import { sendCastCommand, CastDevice } from './castService';
import { getActiveCastTarget } from './castState';
import { reportPlaybackProgress } from './sessionApi';

export interface ActivePlayerMedia {
  id: string;
  title: string;
  slug?: string;
  posterUrl?: string;
  streamUrl: string;
  isLive?: boolean;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  activeAudio: string;
  activeSubtitle: string;
  share?: string;
  isCorrupted?: boolean;
  corruptedReason?: string;
}

export interface LastPlaybackInfo {
  id: string;
  title: string;
  posterUrl?: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
}

export interface PlayerStoreState {
  activeMedia: ActivePlayerMedia | null;
  lastPlayback: LastPlaybackInfo | null;
  isMinimized: boolean;
  isExpanded: boolean;
  isMuted: boolean;
  volume: number;
}

const STORAGE_LAST_KEY = 'ums_last_playback';

function loadLastPlayback(): LastPlaybackInfo | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(STORAGE_LAST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.title) return parsed;
  } catch {}
  return null;
}

function saveLastPlayback(info: LastPlaybackInfo | null) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (info) {
      localStorage.setItem(STORAGE_LAST_KEY, JSON.stringify(info));
    } else {
      localStorage.removeItem(STORAGE_LAST_KEY);
    }
  } catch {}
}

let state: PlayerStoreState = {
  activeMedia: null,
  lastPlayback: loadLastPlayback(),
  isMinimized: false,
  isExpanded: false,
  isMuted: false,
  volume: 1,
};

const listeners = new Set<(s: PlayerStoreState) => void>();

function notify() {
  const s = { ...state };
  listeners.forEach((fn) => fn(s));
}

let saveTimer: any = null;

export const playerStore = {
  getState(): PlayerStoreState {
    return state;
  },

  openMedia(media: Omit<ActivePlayerMedia, 'isPlaying' | 'positionSeconds' | 'durationSeconds'> & { initialTime?: number }) {
    const pos = media.initialTime || 0;
    state.activeMedia = {
      ...media,
      positionSeconds: pos,
      durationSeconds: 0,
      isPlaying: true,
      activeAudio: media.activeAudio || 'auto',
      activeSubtitle: media.activeSubtitle || 'off',
    };
    state.isMinimized = false;

    // Mise à jour de la dernière lecture mémorisée
    state.lastPlayback = {
      id: media.id,
      title: media.title,
      posterUrl: media.posterUrl,
      positionSeconds: pos,
      durationSeconds: 0,
      updatedAt: Date.now(),
    };
    saveLastPlayback(state.lastPlayback);
    notify();
  },

  setPlaying(isPlaying: boolean) {
    if (!state.activeMedia) return;
    state.activeMedia.isPlaying = isPlaying;
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, isPlaying ? 'PLAY' : 'PAUSE');
    }
  },

  togglePlayPause() {
    if (!state.activeMedia) {
      if (state.lastPlayback) {
        this.resumeLastPlayback();
      }
      return;
    }
    this.setPlaying(!state.activeMedia.isPlaying);
  },

  updateProgress(current: number, duration: number) {
    if (!state.activeMedia) return;
    state.activeMedia.positionSeconds = current;
    if (duration > 0) state.activeMedia.durationSeconds = duration;

    // Débounce de la sauvegarde locale et signalement serveur
    if (state.lastPlayback && state.activeMedia.id === state.lastPlayback.id) {
      state.lastPlayback.positionSeconds = current;
      if (duration > 0) state.lastPlayback.durationSeconds = duration;
      state.lastPlayback.updatedAt = Date.now();
      if (!saveTimer) {
        saveTimer = setTimeout(() => {
          saveLastPlayback(state.lastPlayback);
          if (!state.activeMedia?.isLive && current > 0) {
            reportPlaybackProgress(state.activeMedia!.id, current, duration, false).catch(() => {});
          }
          saveTimer = null;
        }, 3000);
      }
    }
    notify();
  },

  seekTo(pos: number) {
    if (!state.activeMedia) return;
    state.activeMedia.positionSeconds = pos;
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SEEK', { positionSeconds: pos });
    }

    if (typeof window !== 'undefined') {
      const v = document.querySelector('video[data-video-player="true"]') as HTMLVideoElement | null;
      if (v) v.currentTime = pos;
    }
  },

  seekRelative(offset: number) {
    if (!state.activeMedia) return;
    const cur = state.activeMedia.positionSeconds || 0;
    const dur = state.activeMedia.durationSeconds || 7200;
    const target = Math.max(0, Math.min(dur, cur + offset));
    this.seekTo(target);
  },

  setAudio(audio: string) {
    if (!state.activeMedia) return;
    state.activeMedia.activeAudio = audio;
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SET_AUDIO', { audio });
    }
  },

  setSubtitle(sub: string) {
    if (!state.activeMedia) return;
    state.activeMedia.activeSubtitle = sub;
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SET_SUBTITLE', { subtitle: sub });
    }
  },

  setMinimized(min: boolean) {
    state.isMinimized = min;
    notify();
  },

  setExpanded(exp: boolean) {
    state.isExpanded = exp;
    notify();
  },

  setMuted(muted: boolean) {
    state.isMuted = muted;
    notify();
    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, muted ? 'MUTE' : 'UNMUTE');
    }
    if (typeof window !== 'undefined') {
      const v = document.querySelector('video[data-video-player="true"]') as HTMLVideoElement | null;
      if (v) v.muted = muted;
    }
  },

  setVolume(vol: number) {
    state.volume = Math.max(0, Math.min(1, vol));
    notify();
    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SET_VOLUME', { volume: state.volume });
    }
    if (typeof window !== 'undefined') {
      const v = document.querySelector('video[data-video-player="true"]') as HTMLVideoElement | null;
      if (v) v.volume = state.volume;
    }
  },

  closeMedia() {
    if (state.activeMedia) {
      // Sauvegarde position finale
      if (state.lastPlayback && state.activeMedia.id === state.lastPlayback.id) {
        saveLastPlayback(state.lastPlayback);
        if (!state.activeMedia.isLive && state.activeMedia.positionSeconds > 0) {
          reportPlaybackProgress(state.activeMedia.id, state.activeMedia.positionSeconds, state.activeMedia.durationSeconds, false).catch(() => {});
        }
      }
    }
    state.activeMedia = null;
    state.isMinimized = false;
    state.isExpanded = false;
    notify();
  },

  dismissLastPlayback() {
    state.lastPlayback = null;
    saveLastPlayback(null);
    notify();
  },

  async resumeLastPlayback(): Promise<boolean> {
    const last = state.lastPlayback;
    if (!last || !last.id) return false;

    try {
      const token = getAuthToken();
      const base = `${getApiBaseUrl()}/api/media/${last.id}/stream`;
      const streamUrl = token ? `${base}?token=${encodeURIComponent(token)}` : base;

      this.openMedia({
        id: last.id,
        title: last.title,
        posterUrl: last.posterUrl,
        streamUrl,
        isLive: false,
        activeAudio: 'auto',
        activeSubtitle: 'off',
        initialTime: last.positionSeconds || 0,
      });
      return true;
    } catch {
      return false;
    }
  },
};

export function usePlayerState(): PlayerStoreState {
  const [s, setS] = useState<PlayerStoreState>(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
