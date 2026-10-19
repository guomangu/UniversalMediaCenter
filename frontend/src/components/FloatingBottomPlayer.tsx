import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Image, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import Hls from 'hls.js';
import { playerStore, usePlayerState } from '@/services/playerStore';
import { useCurrentUser } from '@/services/authStore';
import { useActiveCastTarget, getActiveCastTarget, disconnectCastTotally } from '@/services/castState';
import { sendCastCommand } from '@/services/castService';
import { resolveImageUrl, fetchNextMedia, fetchMediaDetail, getVideoStreamUrl } from '@/services/api';
import { fetchMediaTracks, MediaTracksData } from '@/services/mediaTracksApi';
import { toggleFullscreen, isFullscreenActive } from '@/utils/fullscreen';
import { PlayerSubtitleModal } from './PlayerSubtitleModal';
import { PlayerAudioModal } from './PlayerAudioModal';
import { PlayerShareModal } from './PlayerShareModal';
import { MediaRepostModal } from './MediaRepostModal';
import { CastModal } from './CastModal';
import { styles } from './FloatingBottomPlayer.styles';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const FloatingBottomPlayer: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const playerState = usePlayerState();
  const activeCastTarget = useActiveCastTarget();
  const currentUser = useCurrentUser();

  const [tracks, setTracks] = useState<MediaTracksData>({ audioTracks: [], subtitleTracks: [], qualities: [] });
  const [showSubModal, setShowSubModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showCastModal, setShowCastModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);

  const [mouseActive, setMouseActive] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showRestartBtn, setShowRestartBtn] = useState(false);
  const [introChapter, setIntroChapter] = useState<{ start: number; end: number } | null>(null);
  const [nextNode, setNextNode] = useState<{ id: string; title: string; displayBadge?: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPos, setScrubPos] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const isScrubbingRef = useRef(false);
  const scrubTargetRef = useRef<number | null>(null);
  const scrubberExpandedRef = useRef<any>(null);
  const scrubberCollapsedRef = useRef<any>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const userInitiatedActionRef = useRef<'PLAY' | 'PAUSE' | 'SEEK' | null>(null);
  const lastUserPlayRequestTimeRef = useRef<number>(0);
  const mouseTimer = useRef<any>(null);
  const countdownTimer = useRef<any>(null);
  const prevStreamUrlRef = useRef<string>('');
  const lastToggleTimeRef = useRef<number>(0);
  const lastSeekTimeRef = useRef<number>(0);
  const lastExpandTimeRef = useRef<number>(0);
  const lastCollapseTimeRef = useRef<number>(0);
  const lastCloseTimeRef = useRef<number>(0);

  const activeMedia = playerState.activeMedia;
  const lastPlayback = playerState.lastPlayback;
  const isExpanded = playerState.isExpanded;

  const isCasting = Boolean(activeCastTarget);
  const mediaTitle = activeCastTarget?.mediaTitle || activeMedia?.title || 'Média en cours';
  const pos = isCasting
    ? (typeof activeCastTarget?.positionSeconds === 'number' && activeCastTarget.positionSeconds > 0
        ? activeCastTarget.positionSeconds
        : (activeMedia?.positionSeconds ?? (localVideoRef.current?.currentTime || 0)))
    : (activeMedia?.positionSeconds ?? (localVideoRef.current?.currentTime || 0));
  const dur = isCasting
    ? (typeof activeCastTarget?.durationSeconds === 'number' && activeCastTarget.durationSeconds > 0
        ? activeCastTarget.durationSeconds
        : (activeMedia?.durationSeconds ?? 0))
    : (activeMedia?.durationSeconds ?? 0);
  const effectiveDur = dur > 0 ? dur : (localVideoRef.current?.duration && Number.isFinite(localVideoRef.current.duration) ? Math.floor(localVideoRef.current.duration) : 0);
  const currentPos = scrubPos !== null ? scrubPos : pos;
  const currentDur = effectiveDur;
  const isPlaying = isCasting ? Boolean(activeCastTarget?.isPlaying) : Boolean(activeMedia?.isPlaying);
  const posterUri = resolveImageUrl(activeMedia?.posterUrl || activeCastTarget?.posterUrl);

  const pct = currentDur > 0 ? Math.min(100, Math.max(0, (currentPos / currentDur) * 100)) : 0;

  // Calcul dynamique des styles responsive pour la miniature vidéo et son ancrage
  const miniVideoStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: isMobile ? 24 : 22,
    left: 10,
    width: isMobile ? 50 : 58,
    height: isMobile ? 36 : 40,
    borderRadius: 6,
    overflow: 'hidden' as const,
    backgroundColor: '#000000',
    zIndex: 10,
    cursor: 'pointer' as const,
  }), [isMobile]);

  const posterThumbStyle = useMemo(() => ({
    width: isMobile ? 50 : 58,
    height: isMobile ? 36 : 40,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    marginRight: isMobile ? 8 : 10,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    flexShrink: 0,
  }), [isMobile]);

  // Réinitialisation du minuteur d'inactivité de la souris en mode cinéma déplié
  const resetMouseActivity = useCallback(() => {
    setMouseActive(true);
    if (mouseTimer.current) clearTimeout(mouseTimer.current);
    mouseTimer.current = setTimeout(() => {
      setMouseActive(false);
    }, 3500);
  }, []);

  useEffect(() => {
    if (isExpanded) {
      resetMouseActivity();
    }
  }, [isExpanded, resetMouseActivity]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(isFullscreenActive());
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', handleFsChange);
      document.addEventListener('webkitfullscreenchange', handleFsChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFsChange);
        document.removeEventListener('webkitfullscreenchange', handleFsChange);
      };
    }
  }, []);

  // Déchargement et destruction immédiate si l'utilisateur est déconnecté (sans token de partage public)
  useEffect(() => {
    if (!currentUser && !activeMedia?.share) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      const v = localVideoRef.current;
      if (v) {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch {}
      }
    }
  }, [currentUser, activeMedia?.share]);

  // Hook 1 : Chargement des métadonnées enrichies (pistes audio, sous-titres, chapitres intro, next épisode)
  useEffect(() => {
    if (activeMedia?.id) {
      fetchMediaTracks(activeMedia.id).then((t) => {
        setTracks(t);
        if (t?.requiresHls && activeMedia?.streamUrl && !activeMedia.streamUrl.includes('.m3u8') && !activeMedia.isLive) {
          const hlsUrl = getVideoStreamUrl(activeMedia.id, activeMedia.share, true);
          const curPos = localVideoRef.current?.currentTime || activeMedia.positionSeconds || 0;
          playerStore.updateStreamUrl(hlsUrl, curPos);
        }
      }).catch(() => {});
      fetchNextMedia(activeMedia.id).then(setNextNode).catch(() => {});

      if (!activeMedia.isLive) {
        fetchMediaDetail(activeMedia.id).then((res) => {
          if (res?.media?.chaptersJson) {
            const intro = res.media.chaptersJson.find(
              (c: any) =>
                c.title &&
                (c.title.toLowerCase().includes('intro') ||
                  c.title.toLowerCase().includes('opening') ||
                  c.title.toLowerCase().includes('générique') ||
                  c.title.toLowerCase().includes('generique'))
            );
            if (intro) {
              setIntroChapter({ start: intro.start, end: intro.end });
            }
          }
        }).catch(() => {});
      }
    }
  }, [activeMedia?.id, activeMedia?.isLive]);

  // Hook 2 : Gestion du cycle de vie du flux vidéo dans le lecteur autonome persistant
  useEffect(() => {
    if (Platform.OS !== 'web' || !activeMedia?.streamUrl || isCasting) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      prevStreamUrlRef.current = '';
      return;
    }

    const v = localVideoRef.current;
    if (!v) return;

    v.muted = playerState.isMuted;
    v.volume = playerState.volume;

    const streamUrl = activeMedia.streamUrl;
    const isLive = Boolean(activeMedia.isLive);
    const shouldUseHls = Boolean(
      (streamUrl.includes('.m3u8') || streamUrl.includes('/iptv/') || isLive) &&
      typeof window !== 'undefined' &&
      Hls.isSupported()
    );

    // Si le flux actuel est déjà attaché et inchangé, préserver l'instance et la lecture sans rechargement
    if (prevStreamUrlRef.current === streamUrl && (hlsInstanceRef.current || (v.src && v.src.endsWith(streamUrl)))) {
      return;
    }
    prevStreamUrlRef.current = streamUrl;

    const tryAutoplay = () => {
      if (activeMedia.isPlaying) {
        const p = v.play();
        if (p !== undefined) {
          p.catch((err) => {
            if (err.name === 'NotAllowedError') {
              v.muted = true;
              setAudioBlocked(true);
              v.play().catch(() => {});
            }
          });
        }
      }
    };

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    if (shouldUseHls) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
      });
      hlsInstanceRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        v.muted = playerState.isMuted;
        v.volume = playerState.volume;
        if (activeMedia.positionSeconds > 0 && Math.abs(v.currentTime - activeMedia.positionSeconds) > 1.5) {
          v.currentTime = activeMedia.positionSeconds;
        }
        tryAutoplay();
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (!data.fatal) {
          if (data.details === "bufferStalledError") {
            const curState = playerStore.getState().activeMedia;
            if (curState?.isPlaying && v.paused) {
              v.play().catch(() => {});
            }
          }
          return;
        }
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            {
              const curState = playerStore.getState().activeMedia;
              if (curState?.isPlaying && v.paused) {
                v.play().catch(() => {});
              }
            }
            break;
          default:
            break;
        }
      });
    } else {
      if (v.src !== streamUrl) {
        v.src = streamUrl;
      }
      v.muted = playerState.isMuted;
      v.volume = playerState.volume;
      if (activeMedia.positionSeconds > 0 && Math.abs(v.currentTime - activeMedia.positionSeconds) > 1.5) {
        v.currentTime = activeMedia.positionSeconds;
      }
      tryAutoplay();
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [activeMedia?.id, activeMedia?.streamUrl, isCasting]);

  // Hook 3 : Synchronisation univoque Play/Pause sans détruire Hls
  useEffect(() => {
    const v = localVideoRef.current;
    if (!v || isCasting) return;
    // Si l'utilisateur vient d'initier une action manuelle directe, le lecteur local a déjà été ordonné
    if (userInitiatedActionRef.current) return;

    if (activeMedia?.isPlaying && v.paused) {
      const p = v.play();
      if (p !== undefined) {
        p.catch((err: any) => {
          if (err?.name === 'NotAllowedError') {
            v.muted = true;
            setAudioBlocked(true);
            v.play().catch(() => {});
          }
        });
      }
    } else if (!activeMedia?.isPlaying && !v.paused) {
      v.pause();
    }
  }, [activeMedia?.isPlaying, isExpanded, isCasting]);

  // Hook 4 : Synchronisation volume & mute
  useEffect(() => {
    const v = localVideoRef.current;
    if (!v || isCasting) return;
    v.muted = playerState.isMuted;
    v.volume = playerState.volume;
  }, [playerState.isMuted, playerState.volume, isCasting]);

  // Hook 5 : Compte à rebours automatique pour le prochain épisode (style Netflix)
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextNode) {
        handlePlayNext();
      }
      return;
    }
    countdownTimer.current = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, [countdown, nextNode]);

  // Raccourcis clavier en mode déplié (Espace, Flèches, Échap, Plein Écran)
  useEffect(() => {
    if (!isExpanded || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

      resetMouseActivity();

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        handleSeekRelative(-10);
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        handleSeekRelative(30);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playerStore.setVolume(Math.min(1, playerState.volume + 0.1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        playerStore.setVolume(Math.max(0, playerState.volume - 0.1));
      } else if (e.key === 'm') {
        e.preventDefault();
        playerStore.setMuted(!playerState.isMuted);
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, isPlaying, playerState.volume, playerState.isMuted, resetMouseActivity]);

  const extractClientX = useCallback((e: any): number | null => {
    if (typeof e?.clientX === 'number') return e.clientX;
    if (typeof e?.nativeEvent?.clientX === 'number') return e.nativeEvent.clientX;
    if (typeof e?.pageX === 'number') return e.pageX;
    if (typeof e?.nativeEvent?.pageX === 'number') return e.nativeEvent.pageX;
    if (e?.touches?.[0]?.clientX !== undefined) return e.touches[0].clientX;
    if (e?.nativeEvent?.touches?.[0]?.clientX !== undefined) return e.nativeEvent.touches[0].clientX;
    if (e?.changedTouches?.[0]?.clientX !== undefined) return e.changedTouches[0].clientX;
    if (e?.nativeEvent?.changedTouches?.[0]?.clientX !== undefined) return e.nativeEvent.changedTouches[0].clientX;
    return null;
  }, []);

  const getTargetFromEvent = useCallback((e: any, isExp: boolean): { target: number; ratio: number } | null => {
    if (Platform.OS !== 'web' || !currentDur) return null;
    const ref = isExp ? scrubberExpandedRef.current : scrubberCollapsedRef.current;
    const el = ref?.getScrollableNode?.() || (ref as any);
    const rect = el?.getBoundingClientRect?.() || e.currentTarget?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return null;

    const clientX = extractClientX(e);
    let ratio: number;
    if (clientX !== null) {
      ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    } else if (typeof e?.nativeEvent?.locationX === 'number') {
      ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / rect.width));
    } else {
      return null;
    }
    const target = Math.floor(ratio * currentDur);
    return { target: Math.max(0, Math.min(currentDur, target)), ratio };
  }, [currentDur, extractClientX]);

  const performSeek = useCallback((target: number) => {
    if (!Number.isFinite(target)) return;
    userInitiatedActionRef.current = 'SEEK';
    if (isCasting && activeCastTarget) {
      activeCastTarget.positionSeconds = target;
      sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: target });
      playerStore.seekTo(target, true, true);
    } else {
      if (localVideoRef.current) {
        localVideoRef.current.currentTime = target;
      }
      playerStore.seekTo(target, true, true);
    }
  }, [isCasting, activeCastTarget]);

  const handleScrubberPointerDown = useCallback((e: any, isExp: boolean) => {
    if (Platform.OS !== 'web' || !currentDur) return;
    const info = getTargetFromEvent(e, isExp);
    if (!info) return;

    isScrubbingRef.current = true;
    scrubTargetRef.current = info.target;
    setIsScrubbing(true);
    setScrubPos(info.target);

    const onPointerMove = (moveEvt: any) => {
      if (!isScrubbingRef.current) return;
      const moveInfo = getTargetFromEvent(moveEvt, isExp);
      if (moveInfo) {
        scrubTargetRef.current = moveInfo.target;
        setScrubPos(moveInfo.target);
      }
    };

    const onPointerUp = (upEvt: any) => {
      if (!isScrubbingRef.current) return;
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      const finalInfo = getTargetFromEvent(upEvt, isExp);
      const finalTarget = finalInfo?.target ?? scrubTargetRef.current;
      if (finalTarget !== null && Number.isFinite(finalTarget)) {
        performSeek(finalTarget);
      }
      setScrubPos(null);
      scrubTargetRef.current = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);
    }
  }, [currentDur, getTargetFromEvent, performSeek]);

  const handleScrubberPointerMove = useCallback((e: any, isExp: boolean) => {
    if (Platform.OS !== 'web' || !currentDur || isScrubbingRef.current) return;
    const info = getTargetFromEvent(e, isExp);
    if (info) {
      setHoverPos(info.target);
      setHoverRatio(info.ratio);
    }
  }, [currentDur, getTargetFromEvent]);

  const handleScrubberPointerLeave = useCallback(() => {
    setHoverPos(null);
    setHoverRatio(null);
  }, []);

  const handleTogglePlay = useCallback((e?: any) => {
    e?.stopPropagation?.();
    if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
      if (document.activeElement.closest?.('[aria-hidden="true"]') || document.activeElement.closest?.('[style*="display: none"]')) {
        (document.activeElement as HTMLElement).blur();
      }
    }
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 250) {
      return;
    }
    lastToggleTimeRef.current = now;

    const currentCast = getActiveCastTarget();
    if (isCasting && currentCast) {
      const isCastPlaying = Boolean(currentCast.isPlaying);
      const nextPlay = !isCastPlaying;
      currentCast.isPlaying = nextPlay;
      sendCastCommand(currentCast.id, nextPlay ? 'PLAY' : 'PAUSE');
      playerStore.setPlaying(nextPlay, true, true);
      return;
    }

    const currentMedia = playerStore.getState().activeMedia;
    if (!currentMedia) {
      if (playerStore.getState().lastPlayback) {
        playerStore.resumeLastPlayback();
      }
      return;
    }

    const nextPlay = !currentMedia.isPlaying;
    userInitiatedActionRef.current = nextPlay ? 'PLAY' : 'PAUSE';
    if (nextPlay) {
      lastUserPlayRequestTimeRef.current = now;
    }
    setTimeout(() => {
      if (userInitiatedActionRef.current === 'PLAY' || userInitiatedActionRef.current === 'PAUSE') {
        userInitiatedActionRef.current = null;
      }
    }, 500);

    playerStore.setPlaying(nextPlay, true, true);
  }, [isCasting]);

  const handleSeekRelative = useCallback((offset: number, e?: any) => {
    e?.stopPropagation?.();
    const now = Date.now();
    if (now - lastSeekTimeRef.current < 200) {
      return;
    }
    lastSeekTimeRef.current = now;

    userInitiatedActionRef.current = 'SEEK';
    if (isCasting && activeCastTarget) {
      const nextPos = Math.max(0, Math.min(dur || 7200, pos + offset));
      activeCastTarget.positionSeconds = nextPos;
      sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: nextPos });
      playerStore.seekTo(nextPos, true, true);
    } else {
      const v = localVideoRef.current;
      if (v) {
        const cur = v.currentTime || 0;
        const target = Math.max(0, Math.min(v.duration || 7200, cur + offset));
        v.currentTime = target;
        playerStore.seekTo(target, true, true);
      } else {
        playerStore.seekRelative(offset);
      }
    }
  }, [isCasting, activeCastTarget, dur, pos]);

  const handleExpand = useCallback((e?: any) => {
    e?.stopPropagation?.();
    if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
    const now = Date.now();
    if (now - lastExpandTimeRef.current < 300) return;
    lastExpandTimeRef.current = now;

    playerStore.setExpanded(true);

    // Maintien ininterrompu de la lecture au dépli
    const v = localVideoRef.current;
    if (v && activeMedia?.isPlaying && v.paused && !isCasting) {
      v.play().catch(() => {});
    }
  }, [isCasting, activeMedia?.isPlaying]);

  const handleCollapse = useCallback((e?: any) => {
    e?.stopPropagation?.();
    if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
    const now = Date.now();
    if (now - lastCollapseTimeRef.current < 300) return;
    lastCollapseTimeRef.current = now;

    // Repli de la div player en bas d écran sans couper la lecture (YouTube-style seamless playback)
    playerStore.setExpanded(false);

    // Maintien ininterrompu de la lecture au repli
    const v = localVideoRef.current;
    if (v && activeMedia?.isPlaying && v.paused && !isCasting) {
      v.play().catch(() => {});
    }

    if (pathname?.startsWith('/player')) {
      if (activeMedia?.id) {
        router.replace(`/media/${activeMedia.id}` as any);
      } else {
        router.replace('/' as any);
      }
    }
  }, [isCasting, pathname, activeMedia?.id, activeMedia?.isPlaying, router]);

  const handleClose = useCallback(async (e?: any) => {
    e?.stopPropagation?.();
    if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
    const now = Date.now();
    if (now - lastCloseTimeRef.current < 300) return;
    lastCloseTimeRef.current = now;

    if (localVideoRef.current) {
      localVideoRef.current.pause();
    }
    if (isCasting) {
      await disconnectCastTotally(false);
    }
    playerStore.closeMedia();
  }, [isCasting]);

  const handleSkipIntro = () => {
    userInitiatedActionRef.current = 'SEEK';
    const target = introChapter ? introChapter.end : (localVideoRef.current?.currentTime || 0) + 85;
    if (localVideoRef.current) localVideoRef.current.currentTime = target;
    setShowSkipIntro(false);
    playerStore.seekTo(target, true, true);
  };

  const handleRestartFromBeginning = () => {
    userInitiatedActionRef.current = 'SEEK';
    setShowRestartBtn(false);
    if (localVideoRef.current) localVideoRef.current.currentTime = 0;
    playerStore.seekTo(0, true, true);
  };

  const handlePlayNext = () => {
    if (!nextNode) return;
    setCountdown(null);
    playerStore.openMedia({
      id: nextNode.id,
      title: nextNode.title,
      streamUrl: `/api/media/${nextNode.id}/stream`,
      posterUrl: `/api/media/${nextNode.id}/poster`,
      isLive: false,
      initialTime: 0,
      expand: true,
    });
  };

  const handleUnmuteGesture = () => {
    const v = localVideoRef.current;
    if (v) {
      v.muted = false;
      v.volume = playerState.volume || 1;
      setAudioBlocked(false);
      playerStore.setMuted(false);
    }
  };

  // --- CONDITIONS D'AFFICHAGE ---

  // Si déconnecté sans token de partage public, le lecteur est strictement inaccessible et invisible
  if (!currentUser && !activeMedia?.share) {
    return null;
  }


  // Si aucun média n'est actif et aucun dernier visionnage disponible
  if (!activeMedia && !lastPlayback && !activeCastTarget) {
    return null;
  }

  // Cas 1 : Aucune lecture en cours, mais reprise disponible (Style YouTube)
  if (!activeMedia && !activeCastTarget && lastPlayback) {
    const resumePosterUri = resolveImageUrl(lastPlayback.posterUrl);
    return (
      <View
        nativeID="player_div"
        {...({ id: 'player_div', 'data-player-div': 'true' } as any)}
        style={styles.containerCollapsed}
      >
        <View style={styles.resumeBar}>
          <View style={styles.resumeLeft}>
            {resumePosterUri ? (
              <View style={posterThumbStyle}>
                <Image source={{ uri: resumePosterUri }} style={styles.posterImg} resizeMode="cover" />
              </View>
            ) : (
              <Text style={styles.resumeIcon}>🍿</Text>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.resumeTitle} numberOfLines={1}>
                Reprendre : {lastPlayback.title}
              </Text>
              <Text style={styles.resumeSub} numberOfLines={1}>
                Position : {formatTime(lastPlayback.positionSeconds)}
                {lastPlayback.durationSeconds > 0 ? ` / ${formatTime(lastPlayback.durationSeconds)}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.resumeActions}>
            <Pressable
              focusable={true}
              style={styles.resumeBtn}
              onPress={() => playerStore.resumeLastPlayback()}
            >
              <Text style={styles.resumeBtnTxt}>▶ Reprendre</Text>
            </Pressable>
            <Pressable
              focusable={true}
              style={styles.dismissBtn}
              onPress={() => playerStore.dismissLastPlayback()}
            >
              <Text style={styles.dismissBtnTxt}>✕</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Sous-titre actif pour injection WebVTT
  const activeSubTrack = tracks.subtitleTracks.find(
    (s) => (s.fileName ? `file:${s.fileName}` : `track:${s.index}`) === activeMedia?.activeSubtitle
  );
  const vttUrl = activeSubTrack && activeMedia?.id ? `/api/media/${activeMedia.id}/subtitles/${encodeURIComponent(activeMedia.activeSubtitle)}` : '';

  // --- RENDU D'UN LECTEUR AUTONOME PERSISTANT DÉPLIABLE ---
  return (
    <View
      nativeID="player_div"
      {...({
        id: 'player_div',
        'data-player-div': 'true',
        'data-expanded': isExpanded ? 'true' : 'false',
        onMouseMove: isExpanded ? resetMouseActivity : undefined,
        onTouchStart: isExpanded ? resetMouseActivity : undefined,
      } as any)}
      style={isExpanded ? styles.containerExpanded : styles.containerCollapsed}
    >
      {/* 1. ÉLÉMENT VIDÉO NOUVEAU CŒUR DU SITE : UNIQUE, CONTINU, JAMAIS DÉTRUIT */}
      <View
        nativeID="player_video_container"
        style={
          isExpanded
            ? styles.videoContainerFull
            : (Platform.OS === 'web' && !isCasting && activeMedia?.streamUrl
                ? miniVideoStyle
                : { display: 'none' })
        }
      >
        {isCasting && isExpanded ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
            {posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={{ width: '100%', height: '100%', opacity: 0.35 }}
                resizeMode="contain"
              />
            ) : null}
            <View style={{ position: 'absolute', alignItems: 'center', padding: 20 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📡</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                Diffusion en cours
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                {activeCastTarget?.name || 'Écran distant'}
              </Text>
            </View>
          </View>
        ) : null}

        {Platform.OS === 'web' && !isCasting && activeMedia?.streamUrl ? (
          <video
            ref={localVideoRef}
            playsInline
            crossOrigin="anonymous"
            tabIndex={-1}
            muted={playerState.isMuted}
            data-player-div-video="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: isExpanded ? 'contain' : 'cover',
              borderRadius: isExpanded ? 0 : 6,
              backgroundColor: '#000',
              zIndex: 1,
              pointerEvents: isExpanded ? 'auto' : 'none',
            }}
            onPlay={() => {
              const action = userInitiatedActionRef.current;
              if (action === 'PLAY') {
                userInitiatedActionRef.current = null;
              }
              if (!playerStore.isApplyingRemoteSync()) {
                playerStore.setPlaying(true, action === 'PLAY', action === 'PLAY');
              }
            }}
            onPause={() => {
              const action = userInitiatedActionRef.current;
              if (action === 'PAUSE') {
                userInitiatedActionRef.current = null;
                if (!playerStore.isApplyingRemoteSync()) {
                  playerStore.setPlaying(false, true, true);
                }
                return;
              }
              // Si la pause n'a pas été expressément demandée par l'utilisateur (ex: layout shift, repli/dépli, navigation),
              // et que le média est en cours de lecture, relancer immédiatement !
              const isPlayWanted = Boolean(playerStore.getState().activeMedia?.isPlaying);
              if (isPlayWanted && !isCasting) {
                const v = localVideoRef.current;
                if (v && v.paused) {
                  v.play().catch(() => {});
                }
              }
            }}
            onTimeUpdate={() => {
              const v = localVideoRef.current;
              if (v) {
                const cur = v.currentTime;
                const d = v.duration || 0;
                playerStore.updateProgress(cur, d);

                // Détection de saut d'intro
                if (introChapter && cur >= introChapter.start && cur <= introChapter.end) {
                  setShowSkipIntro(true);
                } else {
                  setShowSkipIntro(false);
                }

                // Détection de fin de média pour enchaînement automatique
                if (d > 60 && d - cur <= 8 && nextNode && countdown === null) {
                  setCountdown(Math.min(Math.floor(d - cur), 8));
                }
              }
            }}
            onEnded={() => {
              if (nextNode) {
                handlePlayNext();
              } else {
                playerStore.closeMedia();
              }
            }}
            onLoadedMetadata={() => {
              const v = localVideoRef.current;
              if (v) {
                v.muted = playerState.isMuted;
                v.volume = playerState.volume;
                if (
                  activeMedia?.positionSeconds &&
                  activeMedia.positionSeconds > 0 &&
                  Math.abs(v.currentTime - activeMedia.positionSeconds) > 1.5
                ) {
                  v.currentTime = activeMedia.positionSeconds;
                  if (activeMedia.positionSeconds > 10 && v.duration > 60) {
                    setShowRestartBtn(true);
                    setTimeout(() => setShowRestartBtn(false), 5000);
                  }
                }
                                if (activeMedia?.isPlaying && v.paused) {
                  const p = v.play();
                  if (p !== undefined) {
                    p.catch((err: any) => {
                      if (err?.name === "NotAllowedError") {
                        v.muted = true;
                        v.play().catch(() => {});
                        setAudioBlocked(true);
                      }
                    });
                  }
                }
              }
            }}
          >
            {vttUrl && activeMedia?.activeSubtitle !== 'off' ? (
              <track
                kind="subtitles"
                src={vttUrl}
                srcLang={activeSubTrack?.language || 'fr'}
                label={activeSubTrack?.label || 'Français'}
                default
              />
            ) : null}
          </video>
        ) : null}

        {/* Overlay tactile transparent en mode replié pour déplier la vidéo d'un clic */}
        {!isExpanded && Platform.OS === 'web' && !isCasting && activeMedia?.streamUrl ? (
          <Pressable
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Agrandir le lecteur vidéo en plein écran"
            style={StyleSheet.absoluteFill}
            onPress={handleExpand}
            {...({
              onClick: (e: any) => {
                e?.stopPropagation?.();
                handleExpand();
              },
            } as any)}
          />
        ) : null}
      </View>

      {/* 2. MODE DÉPLIÉ (CINÉMA / VUE COMPLÈTE) */}
      {isExpanded ? (
        <>
          {/* Barre Supérieure Dépliée avec bouton Réduire ▼ et Titre */}
          <View style={[styles.topBarExpanded, { opacity: mouseActive || !isPlaying ? 1 : 0 }]}>
            <View style={styles.topBarLeft}>
              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Réduire le lecteur en bas d'écran"
                style={styles.collapseBtn}
                onPress={(e) => {
                  if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
                    (document.activeElement as HTMLElement).blur();
                  }
                  handleCollapse(e);
                }}
              >
                <Text style={styles.collapseBtnTxt}>{isMobile ? '▼' : '▼ Réduire'}</Text>
              </Pressable>
              <Text style={styles.expandedTitle} numberOfLines={1}>
                {isCasting ? `📡 ${mediaTitle}` : mediaTitle}
              </Text>
            </View>

            <View style={styles.topBarRight}>
              <Pressable
                focusable={true}
                style={[styles.topActionBtn, showAudioModal && styles.topActionBtnActive]}
                onPress={() => setShowAudioModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>{isMobile ? '🔊' : '🔊 Audio'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={[styles.topActionBtn, showSubModal && styles.topActionBtnActive]}
                onPress={() => setShowSubModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>{isMobile ? '💬' : '💬 Sous-titres'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={[styles.topActionBtn, isCasting && styles.castBadge]}
                onPress={() => setShowCastModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>
                  {isMobile ? (isCasting ? '📡 Casté' : '📡') : (isCasting ? '📡 Casté' : '📡 Cast')}
                </Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={styles.topActionBtn}
                onPress={() => setShowShareModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>{isMobile ? '🔗' : '🔗 Partager'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={styles.topActionBtn}
                onPress={() => setShowRepostModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>{isMobile ? '⭐' : '⭐ Avis'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={styles.topActionBtn}
                onPress={() => toggleFullscreen()}
              >
                <Text style={styles.topActionBtnTxt}>
                  {isMobile ? '⛶' : (isFullscreen ? '⛶ Réduire' : '⛶ Plein écran')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Zone centrale tactile pour Play/Pause & Contrôles overlay */}
          <Pressable
            style={styles.centerTouchOverlay}
            onPress={handleTogglePlay}
            {...(Platform.OS === 'web'
              ? ({
                  onClick: (e: any) => {
                    e?.stopPropagation?.();
                    handleTogglePlay();
                  },
                } as any)
              : {})}
          >
            {!isPlaying && (
              <View style={styles.centerPlayIcon} pointerEvents="none">
                <Text style={styles.centerPlayIconTxt} pointerEvents="none">▶</Text>
              </View>
            )}
          </Pressable>

          {/* Bannière de reprise du début */}
          {showRestartBtn && (
            <Pressable
              focusable={true}
              style={styles.restartBtn}
              onPress={handleRestartFromBeginning}
            >
              <Text style={styles.restartTxt}>⏮ Recommencer</Text>
            </Pressable>
          )}

          {/* Bouton passer le générique */}
          {showSkipIntro && (
            <Pressable
              focusable={true}
              style={styles.skipIntroBtn}
              onPress={handleSkipIntro}
            >
              <Text style={styles.skipIntroTxt}>⏭ Passer générique</Text>
            </Pressable>
          )}

          {/* Bannière d'activation audio Android */}
          {audioBlocked && (
            <Pressable style={styles.unmuteBanner} onPress={handleUnmuteGesture}>
              <Text style={styles.unmuteBannerTxt}>🔇 Son désactivé — Appuyez pour activer 🔊</Text>
            </Pressable>
          )}

          {/* Overlay Netflix Épisode Suivant */}
          {countdown !== null && nextNode && (
            <View style={styles.nextOverlay}>
              <View style={styles.nextHeader}>
                <Text style={styles.nextCountdown}>Épisode suivant dans {countdown}s</Text>
                {nextNode.displayBadge && (
                  <View style={styles.nextBadge}>
                    <Text style={styles.nextBadgeText}>{nextNode.displayBadge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.nextTitle} numberOfLines={1}>{nextNode.title}</Text>
              <View style={styles.nextActions}>
                <Pressable style={styles.nextPlayBtn} onPress={handlePlayNext}>
                  <Text style={styles.nextPlayBtnText}>▶ Lancer</Text>
                </Pressable>
                <Pressable style={styles.nextCancelBtn} onPress={() => setCountdown(null)}>
                  <Text style={styles.nextCancelBtnText}>Annuler</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Barre inférieure Dépliée (Scrubber & Contrôles) */}
          <View style={[styles.bottomBarExpanded, { opacity: mouseActive || !isPlaying ? 1 : 0 }]}>
            {/* Scrubber haute précision avec glisser-déplacer (drag), hit-box 26px et infobulle */}
            <View
              ref={scrubberExpandedRef}
              style={styles.scrubberExpandedContainer}
              {...({
                onPointerDown: (e: any) => handleScrubberPointerDown(e, true),
                onPointerMove: (e: any) => handleScrubberPointerMove(e, true),
                onPointerLeave: handleScrubberPointerLeave,
              } as any)}
            >
              {hoverRatio !== null && hoverPos !== null && (
                <View style={[styles.scrubberTooltip, { left: `${Math.min(95, Math.max(5, hoverRatio * 100))}%` }]}>
                  <Text style={styles.scrubberTooltipText}>{formatTime(hoverPos)}</Text>
                </View>
              )}
              <View style={styles.scrubberExpandedBg} pointerEvents="none">
                <View style={[styles.scrubberExpandedFill, { width: `${pct}%` }]} />
                <View style={[styles.scrubberThumb, { left: `${pct}%` }]} />
              </View>
            </View>

            <View style={styles.bottomControlsRow}>
              <View style={styles.bottomLeftControls}>
                <Pressable focusable={true} style={styles.controlBtn} onPress={() => handleSeekRelative(-10)}>
                  <Text style={styles.controlBtnTxt}>{isMobile ? '⏪ 10' : '⏪ 10s'}</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.playBtn}
                  onPress={handleTogglePlay}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: (e: any) => {
                          e?.stopPropagation?.();
                          handleTogglePlay();
                        },
                      } as any)
                    : {})}
                >
                  <Text style={styles.playBtnTxt} pointerEvents="none">{isPlaying ? '⏸' : '▶'}</Text>
                </Pressable>

                <Pressable focusable={true} style={styles.controlBtn} onPress={() => handleSeekRelative(30)}>
                  <Text style={styles.controlBtnTxt}>{isMobile ? '30 ⏩' : '30s ⏩'}</Text>
                </Pressable>

                <Text style={styles.timeExpandedText} numberOfLines={1}>
                  {activeMedia?.isLive ? '🔴 Direct' : `${formatTime(currentPos)} / ${formatTime(currentDur)}`}
                </Text>
              </View>

              <View style={styles.bottomRightControls}>
                <Pressable
                  focusable={true}
                  style={styles.volumeBtn}
                  onPress={() => playerStore.setMuted(!playerState.isMuted)}
                >
                  <Text style={styles.volumeBtnTxt}>{playerState.isMuted ? '🔇' : '🔊'}</Text>
                </Pressable>

                {nextNode && (
                  <Pressable focusable={true} style={styles.controlBtn} onPress={handlePlayNext}>
                    <Text style={styles.controlBtnTxt}>{isMobile ? '⏭' : 'Suivant ⏭'}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </>
      ) : (
        /* 3. MODE REPLIÉ (BARRE FLOTTANTE EN BAS DU SITE) */
        <>
          {/* Barre de progression scrubber interactive repliée avec hit-box confortable */}
          <View
            ref={scrubberCollapsedRef}
            style={styles.progressBarContainer}
            {...({
              onPointerDown: (e: any) => handleScrubberPointerDown(e, false),
            } as any)}
          >
            <View style={styles.progressBarBg} pointerEvents="none">
              <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
            </View>
            <View style={[styles.progressBarThumb, { left: `${pct}%` }]} pointerEvents="none" />
          </View>

          <View style={styles.mainRow}>
            {/* Section gauche : Miniature vidéo et Titre (cliquable pour déplier) */}
            <Pressable focusable={true} style={styles.leftSection} onPress={handleExpand}>
              <View style={posterThumbStyle}>
                {posterUri ? (
                  <Image source={{ uri: posterUri }} style={styles.posterImg} resizeMode="cover" />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Text style={styles.posterPlaceholderTxt}>▶</Text>
                  </View>
                )}
              </View>
              <View style={styles.titleCol}>
                <Text style={styles.titleText} numberOfLines={1}>
                  {isCasting ? `📡 ${mediaTitle}` : mediaTitle}
                </Text>
                <Text style={styles.subText} numberOfLines={1}>
                  {isCasting
                    ? `Diffusé sur ${activeCastTarget?.name}`
                    : activeMedia?.isLive
                    ? '🔴 Direct'
                    : `${formatTime(currentPos)} / ${formatTime(currentDur)}`}
                </Text>
              </View>
            </Pressable>

            {/* Section centre : -10s, Play/Pause, +30s */}
            <View style={styles.centerControls}>
              {!isMobile && (
                <Pressable
                  focusable={true}
                  accessibilityRole="button"
                  accessibilityLabel="Reculer de 10 secondes"
                  style={styles.controlBtn}
                  onPress={() => handleSeekRelative(-10)}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: (e: any) => {
                          e?.stopPropagation?.();
                          handleSeekRelative(-10);
                        },
                      } as any)
                    : {})}
                >
                  <Text style={styles.controlBtnTxt} pointerEvents="none">-10s</Text>
                </Pressable>
              )}

              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'}
                style={styles.playBtn}
                onPress={handleTogglePlay}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: (e: any) => {
                        e?.stopPropagation?.();
                        handleTogglePlay();
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.playBtnTxt} pointerEvents="none">{isPlaying ? '⏸' : '▶'}</Text>
              </Pressable>

              {!isMobile && (
                <Pressable
                  focusable={true}
                  accessibilityRole="button"
                  accessibilityLabel="Avancer de 30 secondes"
                  style={styles.controlBtn}
                  onPress={() => handleSeekRelative(30)}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: (e: any) => {
                          e?.stopPropagation?.();
                          handleSeekRelative(30);
                        },
                      } as any)
                    : {})}
                >
                  <Text style={styles.controlBtnTxt} pointerEvents="none">+30s</Text>
                </Pressable>
              )}
            </View>

            {/* Section droite : Options, Déplier ▲, Fermer ✕ */}
            <View style={styles.rightSection}>
              {audioBlocked && (
                <Pressable
                  focusable={true}
                  style={[styles.actionChip, { backgroundColor: '#f59e0b' }]}
                  onPress={handleUnmuteGesture}
                  accessibilityLabel="Activer le son"
                >
                  <Text style={styles.actionChipTxt}>🔇 Activer son</Text>
                </Pressable>
              )}
              {!isMobile && (
                <>
                  <Pressable
                    focusable={true}
                    style={[styles.actionChip, showAudioModal && styles.actionChipActive]}
                    onPress={() => setShowAudioModal(true)}
                  >
                    <Text style={styles.actionChipTxt}>🔊</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    style={[styles.actionChip, showSubModal && styles.actionChipActive]}
                    onPress={() => setShowSubModal(true)}
                  >
                    <Text style={styles.actionChipTxt}>💬</Text>
                  </Pressable>
                </>
              )}

              <Pressable
                focusable={true}
                style={[styles.actionChip, isCasting && styles.castBadge]}
                onPress={() => setShowCastModal(true)}
              >
                <Text style={styles.actionChipTxt}>{isCasting ? '📡 Casté' : '📡'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Déplier le lecteur en plein écran"
                style={styles.expandBtn}
                onPress={handleExpand}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: (e: any) => {
                        e?.stopPropagation?.();
                        handleExpand();
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.expandBtnTxt} pointerEvents="none">{isMobile ? '▲' : '▲ Déplier'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Fermer la lecture"
                style={styles.closeBtn}
                onPress={handleClose}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: (e: any) => {
                        e?.stopPropagation?.();
                        handleClose();
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.closeBtnTxt} pointerEvents="none">✕</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* MODALES D'OPTIONS DU LECTEUR */}
      <PlayerSubtitleModal
        visible={showSubModal}
        activeSubtitle={activeMedia?.activeSubtitle || 'off'}
        tracks={tracks.subtitleTracks}
        onSelect={(subId) => {
          playerStore.setSubtitle(subId, true, true);
          setShowSubModal(false);
        }}
        onClose={() => setShowSubModal(false)}
      />

      <PlayerAudioModal
        visible={showAudioModal}
        activeAudio={activeMedia?.activeAudio || 'auto'}
        tracks={tracks.audioTracks}
        onSelect={(audioId) => {
          playerStore.setAudio(audioId, true, true);
          setShowAudioModal(false);
        }}
        onClose={() => setShowAudioModal(false)}
      />

      <CastModal
        visible={showCastModal}
        onClose={() => setShowCastModal(false)}
        currentMedia={{
          id: activeMedia?.id || '',
          title: mediaTitle,
          streamUrl: activeMedia?.streamUrl || '',
          positionSeconds: localVideoRef.current?.currentTime || pos,
          posterUrl: activeMedia?.posterUrl,
        }}
      />

      {activeMedia?.id && (
        <>
          <PlayerShareModal
            visible={showShareModal}
            mediaId={activeMedia.id}
            mediaTitle={mediaTitle}
            onClose={() => setShowShareModal(false)}
          />

          <MediaRepostModal
            visible={showRepostModal}
            mediaId={activeMedia.id}
            mediaTitle={mediaTitle}
            onClose={() => setShowRepostModal(false)}
          />
        </>
      )}
    </View>
  );
};
