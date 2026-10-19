import { useState, useEffect } from 'react';
import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getAuthToken, getCurrentUser } from './authStore';
import { sendCastCommand, CastDevice } from './castService';
import { getActiveCastTarget, subscribeActiveCastTarget, disconnectCastTotally } from './castState';
import { reportPlaybackProgress } from './sessionApi';
import { getVideoStreamUrl } from './api';

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
  streamUrl?: string;
}

export interface PlayerStoreState {
  activeMedia: ActivePlayerMedia | null;
  lastPlayback: LastPlaybackInfo | null;
  isMinimized: boolean;
  isExpanded: boolean;
  isMuted: boolean;
  volume: number;
}

export type PlaybackBroadcaster = {
  report: (payload: any, isAction?: boolean) => Promise<void> | void;
  stop: () => Promise<void> | void;
};

let playbackBroadcaster: PlaybackBroadcaster | null = null;

export function registerPlaybackBroadcaster(broadcaster: PlaybackBroadcaster) {
  playbackBroadcaster = broadcaster;
}

const STORAGE_LAST_PLAYBACK_KEY = 'ums_last_playback';

function loadLastPlayback(): LastPlaybackInfo | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(STORAGE_LAST_PLAYBACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLastPlayback(info: LastPlaybackInfo | null) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (info) {
      localStorage.setItem(STORAGE_LAST_PLAYBACK_KEY, JSON.stringify(info));
    } else {
      localStorage.removeItem(STORAGE_LAST_PLAYBACK_KEY);
    }
  } catch {}
}

const state: PlayerStoreState = {
  activeMedia: null,
  lastPlayback: loadLastPlayback(),
  isMinimized: false,
  isExpanded: false,
  isMuted: false,
  volume: 1,
};

const listeners = new Set<(s: PlayerStoreState) => void>();
const remoteAudioListeners = new Set<(audio: string) => void>();
const remoteSubtitleListeners = new Set<(sub: string) => void>();

export function onRemoteAudioChange(fn: (audio: string) => void): () => void {
  remoteAudioListeners.add(fn);
  return () => {
    remoteAudioListeners.delete(fn);
  };
}

export function onRemoteSubtitleChange(fn: (sub: string) => void): () => void {
  remoteSubtitleListeners.add(fn);
  return () => {
    remoteSubtitleListeners.delete(fn);
  };
}

let saveTimer: any = null;
let lastProgressBroadcastPos = -1;
let remoteSyncLockDepth = 0;
let lastUserActionTimestamp = 0;

export function recordUserAction(): void {
  lastUserActionTimestamp = Date.now();
}

export function getLastUserActionTimestamp(): number {
  return lastUserActionTimestamp;
}

export function isWithinUserGracePeriod(graceMs = 4000): boolean {
  return Date.now() - lastUserActionTimestamp < graceMs;
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

// Maintien du lecteur du site en synchronisation totale avec le média casté
if (typeof window !== 'undefined') {
  subscribeActiveCastTarget((live) => {
    if (live && state.activeMedia) {
      let changed = false;
      if (typeof live.positionSeconds === 'number' && Math.abs(state.activeMedia.positionSeconds - live.positionSeconds) > 1.2) {
        state.activeMedia.positionSeconds = live.positionSeconds;
        changed = true;
      }
      if (typeof live.durationSeconds === 'number' && live.durationSeconds > 0 && state.activeMedia.durationSeconds !== live.durationSeconds) {
        state.activeMedia.durationSeconds = live.durationSeconds;
        changed = true;
      }
      const isLivePlaying = Boolean(live.isPlaying);
      if (state.activeMedia.isPlaying !== isLivePlaying) {
        state.activeMedia.isPlaying = isLivePlaying;
        changed = true;
      }
      if (live.audioTrack && state.activeMedia.activeAudio !== live.audioTrack) {
        state.activeMedia.activeAudio = live.audioTrack;
        changed = true;
        remoteAudioListeners.forEach((fn) => fn(live.audioTrack!));
      }
      if (live.subtitleTrack && state.activeMedia.activeSubtitle !== live.subtitleTrack) {
        state.activeMedia.activeSubtitle = live.subtitleTrack;
        changed = true;
        remoteSubtitleListeners.forEach((fn) => fn(live.subtitleTrack!));
      }
      if (changed) {
        notify();
      }
    }
  });
}

export const playerStore = {
  getState(): PlayerStoreState {
    return state;
  },

  isApplyingRemoteSync(): boolean {
    return remoteSyncLockDepth > 0;
  },

  beginRemoteSync() {
    remoteSyncLockDepth++;
  },

  endRemoteSync(delayMs = 600) {
    setTimeout(() => {
      remoteSyncLockDepth = Math.max(0, remoteSyncLockDepth - 1);
    }, delayMs);
  },

  isWithinUserGracePeriod(graceMs = 4000): boolean {
    return isWithinUserGracePeriod(graceMs);
  },

  recordUserAction() {
    recordUserAction();
  },

  updateStreamUrl(newStreamUrl: string, currentPosition?: number) {
    if (!state.activeMedia || state.activeMedia.streamUrl === newStreamUrl) return;
    state.activeMedia.streamUrl = newStreamUrl;
    if (typeof currentPosition === "number" && currentPosition > 0) {
      state.activeMedia.positionSeconds = currentPosition;
    }
    if (state.lastPlayback && state.lastPlayback.id === state.activeMedia.id) {
      state.lastPlayback.streamUrl = newStreamUrl;
      if (typeof currentPosition === "number" && currentPosition > 0) {
        state.lastPlayback.positionSeconds = currentPosition;
      }
      saveLastPlayback(state.lastPlayback);
    }
    notify();
  },

  openMedia(media: {
    id: string;
    title: string;
    slug?: string;
    posterUrl?: string;
    streamUrl: string;
    isLive?: boolean;
    activeAudio?: string;
    activeSubtitle?: string;
    share?: string;
    initialTime?: number;
    isCorrupted?: boolean;
    corruptedReason?: string;
    isRemoteSync?: boolean; // Si true, l'ouverture est initiée par un leader distant
    expand?: boolean; // Si false, ne pas déplier automatiquement
  }) {
    const user = getCurrentUser();
    if (!user && !media.share) {
      return;
    }
    const prevMedia = state.activeMedia;
    const isSameMedia = Boolean(prevMedia && prevMedia.id === media.id);
    const pos = isSameMedia && prevMedia ? prevMedia.positionSeconds : (media.initialTime || 0);
    const dur = isSameMedia && prevMedia ? prevMedia.durationSeconds : 0;
    const isPlaying = isSameMedia && prevMedia ? prevMedia.isPlaying : true;
    const audio = media.activeAudio || (isSameMedia && prevMedia ? prevMedia.activeAudio : 'auto');
    const subtitle = media.activeSubtitle || (isSameMedia && prevMedia ? prevMedia.activeSubtitle : 'off');

    if (!media.isRemoteSync) {
      recordUserAction();
    }
    lastProgressBroadcastPos = Math.floor(pos);

    state.activeMedia = {
      id: media.id,
      title: media.title,
      slug: media.slug,
      posterUrl: media.posterUrl,
      streamUrl: media.streamUrl,
      isLive: media.isLive,
      positionSeconds: pos,
      durationSeconds: dur,
      isPlaying,
      activeAudio: audio,
      activeSubtitle: subtitle,
      share: media.share,
      isCorrupted: media.isCorrupted,
      corruptedReason: media.corruptedReason,
    };
    state.lastPlayback = {
      id: media.id,
      title: media.title,
      posterUrl: media.posterUrl,
      positionSeconds: pos,
      durationSeconds: dur,
      updatedAt: Date.now(),
      streamUrl: media.streamUrl,
    };
    saveLastPlayback(state.lastPlayback);

    if (media.expand !== false && !media.isRemoteSync) {
      state.isExpanded = true;
    }

    if (media.isRemoteSync) {
      this.beginRemoteSync();
      this.endRemoteSync(1500);
    }

    if (typeof window !== 'undefined') {
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        v.muted = false;
        v.volume = 1;
      });
    }

    notify();

    // Si l'ouverture est initiée par une synchronisation distante, ne pas rediffuser pour ne pas écraser le leader
    if (!media.isRemoteSync) {
      playbackBroadcaster?.report({
        mediaId: media.id,
        mediaTitle: media.title,
        posterUrl: media.posterUrl,
        streamUrl: media.streamUrl,
        isLive: media.isLive,
        positionSeconds: pos,
        durationSeconds: dur,
        isPlaying,
        activeAudio: audio,
        activeSubtitle: subtitle,
        volume: state.volume,
        isMuted: state.isMuted,
      }, true); // isAction: true (prise de leadership légitime : "le dernier appareil touchant le player a raison")
    }
  },

  setPlaying(isPlaying: boolean, shouldBroadcast = true, isExplicitAction = false) {
    if (!state.activeMedia) return;
    state.activeMedia.isPlaying = isPlaying;
    if (isExplicitAction) {
      recordUserAction();
    }
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, isPlaying ? 'PLAY' : 'PAUSE');
    } else if (typeof window !== 'undefined') {
      const v = (document.querySelector('video[data-player-div-video=\"true\"]') ||
        document.querySelector('video[data-video-player=\"true\"]')) as HTMLVideoElement | null;
      if (v) {
        if (isPlaying && v.paused) {
          const p = v.play();
          if (p !== undefined) {
            p.catch((err: any) => {
              if (err?.name === 'NotAllowedError') {
                v.muted = true;
                v.play().catch(() => {});
              }
            });
          }
        } else if (!isPlaying && !v.paused) {
          v.pause();
        }
      }
    }

    if (shouldBroadcast) {
      playbackBroadcaster?.report({
        mediaId: state.activeMedia.id,
        mediaTitle: state.activeMedia.title,
        isPlaying,
        positionSeconds: state.activeMedia.positionSeconds,
      }, isExplicitAction);
    }
  },

  togglePlayPause() {
    if (!state.activeMedia) {
      if (state.lastPlayback) {
        this.resumeLastPlayback();
      }
      return;
    }
    this.setPlaying(!state.activeMedia.isPlaying, true, true);
  },

  updateProgress(current: number, duration: number) {
    this.updatePosition(current, duration);
  },

  syncPlayingFromRemote(isPlaying: boolean) {
    if (!state.activeMedia) return;
    if (state.activeMedia.isPlaying === isPlaying) return;
    state.activeMedia.isPlaying = isPlaying;
    notify();

    if (typeof window !== 'undefined') {
      const v = (document.querySelector('video[data-player-div-video=\"true\"]') ||
        document.querySelector('video[data-video-player=\"true\"]')) as HTMLVideoElement | null;
      if (v) {
        this.beginRemoteSync();
        try {
          if (isPlaying && v.paused) {
            const p = v.play();
            if (p !== undefined) {
              p.catch((err: any) => {
                if (err?.name === 'NotAllowedError') {
                  v.muted = true;
                  v.play().catch(() => {});
                }
              });
            }
          } else if (!isPlaying && !v.paused) {
            v.pause();
          }
        } finally {
          this.endRemoteSync(1000);
        }
      }
    }
  },

  updatePosition(current: number, duration: number) {
    if (!state.activeMedia) return;
    const prevSec = Math.floor(state.activeMedia.positionSeconds);
    const newSec = Math.floor(current);

    state.activeMedia.positionSeconds = current;
    if (duration > 0) state.activeMedia.durationSeconds = duration;

    if (state.lastPlayback && state.lastPlayback.id === state.activeMedia.id) {
      state.lastPlayback.positionSeconds = current;
      if (duration > 0) state.lastPlayback.durationSeconds = duration;
      state.lastPlayback.updatedAt = Date.now();
      const currentMediaId = state.activeMedia.id;
      const isLiveMedia = Boolean(state.activeMedia.isLive);

      if (!saveTimer) {
        saveTimer = setTimeout(() => {
          saveLastPlayback(state.lastPlayback);
          if (state.activeMedia && state.activeMedia.id === currentMediaId && !isLiveMedia && current > 0) {
            reportPlaybackProgress(currentMediaId, current, duration, false).catch(() => {});
          }
          saveTimer = null;
        }, 3000);
      }
    }

    // Diffusion réseau de la progression uniquement par palier de 5 secondes (synchronisation sur changement)
    if (Math.abs(newSec - lastProgressBroadcastPos) >= 5) {
      lastProgressBroadcastPos = newSec;
      playbackBroadcaster?.report({
        mediaId: state.activeMedia.id,
        positionSeconds: current,
        durationSeconds: duration,
        isPlaying: state.activeMedia.isPlaying,
      }, false);
    }

    // N'avertir les composants React via notify() que si la seconde pleine a changé (divise par 4 les re-renders)
    if (prevSec !== newSec) {
      notify();
    }
  },

  seekTo(pos: number, shouldBroadcast = true, isExplicitAction = false) {
    if (!state.activeMedia) return;
    state.activeMedia.positionSeconds = pos;
    if (isExplicitAction) {
      recordUserAction();
    }
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SEEK', { positionSeconds: pos });
    }

    if (!shouldBroadcast) {
      this.beginRemoteSync();
    }

    if (typeof window !== 'undefined') {
      const v = (document.querySelector('video[data-player-div-video=\"true\"]') ||
        document.querySelector('video[data-video-player=\"true\"]')) as HTMLVideoElement | null;
      if (v) v.currentTime = pos;
    }

    if (!shouldBroadcast) {
      this.endRemoteSync(800);
    }

    if (shouldBroadcast) {
      playbackBroadcaster?.report({
        mediaId: state.activeMedia.id,
        mediaTitle: state.activeMedia.title,
        positionSeconds: pos,
        isPlaying: state.activeMedia.isPlaying,
      }, isExplicitAction);
    }
  },

  seekRelative(offset: number) {
    if (!state.activeMedia) return;
    const cur = state.activeMedia.positionSeconds || 0;
    const dur = state.activeMedia.durationSeconds || 7200;
    const target = Math.max(0, Math.min(dur, cur + offset));
    this.seekTo(target, true, true);
  },

  setAudio(audio: string, shouldBroadcast = true, isExplicitAction = false) {
    if (!state.activeMedia) return;
    state.activeMedia.activeAudio = audio;
    if (state.activeMedia.id) {
      const base = getVideoStreamUrl(state.activeMedia.id, state.activeMedia.share);
      const p = new URLSearchParams();
      if (audio && audio !== 'auto') p.set('audio', audio);
      if (state.activeMedia.share) p.set('share', state.activeMedia.share);
      const qs = p.toString();
      state.activeMedia.streamUrl = qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
    }
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SET_AUDIO', { audio });
    }

    if (shouldBroadcast) {
      playbackBroadcaster?.report({
        activeAudio: audio,
        positionSeconds: state.activeMedia.positionSeconds,
      }, isExplicitAction);
    }
  },

  syncAudioFromRemote(audio: string) {
    if (!state.activeMedia || state.activeMedia.activeAudio === audio) return;
    this.setAudio(audio, false, false);
    remoteAudioListeners.forEach((fn) => fn(audio));
  },

  setSubtitle(sub: string, shouldBroadcast = true, isExplicitAction = false) {
    if (!state.activeMedia) return;
    state.activeMedia.activeSubtitle = sub;
    notify();

    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SET_SUBTITLE', { subtitle: sub });
    }

    if (shouldBroadcast) {
      playbackBroadcaster?.report({
        activeSubtitle: sub,
        positionSeconds: state.activeMedia.positionSeconds,
      }, isExplicitAction);
    }
  },

  syncSubtitleFromRemote(sub: string) {
    if (!state.activeMedia || state.activeMedia.activeSubtitle === sub) return;
    this.setSubtitle(sub, false, false);
    remoteSubtitleListeners.forEach((fn) => fn(sub));
  },

  setMinimized(min: boolean) {
    state.isMinimized = min;
    notify();
  },

  setExpanded(exp: boolean) {
    state.isExpanded = exp;
    notify();
  },

  toggleExpanded() {
    state.isExpanded = !state.isExpanded;
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
      const v = (document.querySelector('video[data-player-div-video=\"true\"]') ||
        document.querySelector('video[data-video-player=\"true\"]')) as HTMLVideoElement | null;
      if (v) v.muted = muted;
    }
    playbackBroadcaster?.report({
      isMuted: muted,
    }, true);
  },

  setVolume(vol: number) {
    state.volume = Math.max(0, Math.min(1, vol));
    notify();
    const cast = getActiveCastTarget();
    if (cast) {
      sendCastCommand(cast.id, 'SET_VOLUME', { volume: state.volume });
    }
    if (typeof window !== 'undefined') {
      const v = (document.querySelector('video[data-player-div-video=\"true\"]') ||
        document.querySelector('video[data-video-player=\"true\"]')) as HTMLVideoElement | null;
      if (v) v.volume = state.volume;
    }
    playbackBroadcaster?.report({
      volume: state.volume,
    }, true);
  },

  closeMedia() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (typeof window !== "undefined") {
      try {
        const videos = document.querySelectorAll("video");
        videos.forEach((v) => {
          try {
            v.pause();
            v.removeAttribute("src");
            v.load();
          } catch {}
        });
      } catch {}
    }
    if (state.activeMedia) {
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
    playbackBroadcaster?.stop();
  },

  dismissLastPlayback() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    state.lastPlayback = null;
    saveLastPlayback(null);
    notify();
  },

  async resumeLastPlayback(): Promise<boolean> {
    const user = getCurrentUser();
    if (!user) return false;

    const last = state.lastPlayback;
    if (!last || !last.id) return false;

    try {
      const token = getAuthToken();
      let streamUrl = last.streamUrl;
      if (!streamUrl) {
        const base = `${getApiBaseUrl()}/api/media/${last.id}/stream`;
        streamUrl = token ? `${base}?token=${encodeURIComponent(token)}` : base;
      }

      this.openMedia({
        id: last.id,
        title: last.title,
        posterUrl: last.posterUrl,
        streamUrl,
        isLive: false,
        activeAudio: 'auto',
        activeSubtitle: 'off',
        initialTime: last.positionSeconds || 0,
        expand: true,
      });
      return true;
    } catch {
      return false;
    }
  },
};

if (typeof window !== "undefined") {
  (window as any).playerStore = playerStore;
}

export function usePlayerState(): PlayerStoreState {
  const [s, setS] = useState<PlayerStoreState>({ ...playerStore.getState() });

  useEffect(() => {
    const update = (next: PlayerStoreState) => setS({ ...next });
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return s;
}

if (typeof window !== "undefined") {
  window.addEventListener("ums_logout", () => {
    playerStore.closeMedia();
    playerStore.dismissLastPlayback();
    try {
      disconnectCastTotally(false);
    } catch {}
  });
}
