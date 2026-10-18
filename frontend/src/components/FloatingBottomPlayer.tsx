import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Image, Platform, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import Hls from 'hls.js';
import { playerStore, usePlayerState } from '@/services/playerStore';
import { useActiveCastTarget, disconnectCastTotally } from '@/services/castState';
import { sendCastCommand } from '@/services/castService';
import { resolveImageUrl, fetchNextMedia, fetchMediaDetail } from '@/services/api';
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

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const userInitiatedRef = useRef<boolean>(false);
  const mouseTimer = useRef<any>(null);
  const countdownTimer = useRef<any>(null);
  const prevStreamUrlRef = useRef<string>('');

  const activeMedia = playerState.activeMedia;
  const lastPlayback = playerState.lastPlayback;
  const isExpanded = playerState.isExpanded;

  const isCasting = Boolean(activeCastTarget);
  const mediaTitle = activeCastTarget?.mediaTitle || activeMedia?.title || 'Média en cours';
  const pos = isCasting ? (activeCastTarget?.positionSeconds ?? 0) : (activeMedia?.positionSeconds ?? 0);
  const dur = isCasting ? (activeCastTarget?.durationSeconds ?? 0) : (activeMedia?.durationSeconds ?? 0);
  const isPlaying = isCasting ? Boolean(activeCastTarget?.isPlaying) : Boolean(activeMedia?.isPlaying);
  const posterUri = resolveImageUrl(activeMedia?.posterUrl || activeCastTarget?.posterUrl);

  const pct = dur > 0 ? (pos / dur) * 100 : 0;

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

  // Hook 1 : Chargement des métadonnées enrichies (pistes audio, sous-titres, chapitres intro, next épisode)
  useEffect(() => {
    if (activeMedia?.id) {
      fetchMediaTracks(activeMedia.id).then(setTracks).catch(() => {});
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
    if (activeMedia?.isPlaying && v.paused) {
      v.play().catch(() => {});
    } else if (!activeMedia?.isPlaying && !v.paused) {
      v.pause();
    }
  }, [activeMedia?.isPlaying, isCasting]);

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

  const handleBarClick = (e: any) => {
    if (Platform.OS !== 'web' || !dur) return;
    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = Math.floor(ratio * dur);
    userInitiatedRef.current = true;
    if (isCasting && activeCastTarget) {
      sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: target });
    } else {
      if (localVideoRef.current) {
        localVideoRef.current.currentTime = target;
      }
      playerStore.seekTo(target, true, true);
    }
  };

  const handleTogglePlay = () => {
    userInitiatedRef.current = true;
    if (isCasting && activeCastTarget) {
      sendCastCommand(activeCastTarget.id, isPlaying ? 'PAUSE' : 'PLAY');
    } else {
      const v = localVideoRef.current;
      if (v) {
        if (v.paused) {
          v.play()
            .then(() => playerStore.setPlaying(true, true, true))
            .catch(() => playerStore.setPlaying(false, true, true));
        } else {
          v.pause();
          playerStore.setPlaying(false, true, true);
        }
      } else {
        playerStore.togglePlayPause();
      }
    }
  };

  const handleSeekRelative = (offset: number) => {
    userInitiatedRef.current = true;
    if (isCasting && activeCastTarget) {
      const nextPos = Math.max(0, Math.min(dur || 7200, pos + offset));
      sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: nextPos });
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
  };

  const handleExpand = () => {
    playerStore.setExpanded(true);
  };

  const handleCollapse = () => {
    playerStore.setExpanded(false);
    // Si l'utilisateur était sur l'écran /player/[id], revenir en douceur à la page précédente ou accueil
    if (pathname?.startsWith('/player')) {
      if (activeMedia?.id) {
        router.replace(`/media/${activeMedia.id}` as any);
      } else {
        router.replace('/' as any);
      }
    }
  };

  const handleClose = async () => {
    if (localVideoRef.current) {
      localVideoRef.current.pause();
    }
    if (isCasting) {
      await disconnectCastTotally(false);
    }
    playerStore.closeMedia();
  };

  const handleSkipIntro = () => {
    userInitiatedRef.current = true;
    const target = introChapter ? introChapter.end : (localVideoRef.current?.currentTime || 0) + 85;
    if (localVideoRef.current) localVideoRef.current.currentTime = target;
    setShowSkipIntro(false);
    playerStore.seekTo(target, true, true);
  };

  const handleRestartFromBeginning = () => {
    userInitiatedRef.current = true;
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
              <View style={styles.posterThumb}>
                <Image source={{ uri: resumePosterUri }} style={styles.posterImg} resizeMode="cover" />
              </View>
            ) : (
              <Text style={styles.resumeIcon}>🍿</Text>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.resumeTitle} numberOfLines={1}>
                Reprendre : {lastPlayback.title}
              </Text>
              <Text style={styles.resumeSub}>
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
      <View style={isExpanded ? styles.videoContainerFull : styles.videoContainerMini}>
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
            }}
            onPlay={() => {
              if (userInitiatedRef.current) {
                playerStore.setPlaying(true, true, true);
                userInitiatedRef.current = false;
              }
            }}
            onPause={() => {
              if (userInitiatedRef.current) {
                playerStore.setPlaying(false, true, true);
                userInitiatedRef.current = false;
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
                  v.play().catch(() => {});
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
                onPress={handleCollapse}
              >
                <Text style={styles.collapseBtnTxt}>▼ Réduire</Text>
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
                <Text style={styles.topActionBtnTxt}>🔊 Audio</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={[styles.topActionBtn, showSubModal && styles.topActionBtnActive]}
                onPress={() => setShowSubModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>💬 Sous-titres</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={[styles.topActionBtn, isCasting && styles.topActionBtnActive]}
                onPress={() => setShowCastModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>{isCasting ? '📡 Casté' : '📡 Cast'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={styles.topActionBtn}
                onPress={() => setShowShareModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>🔗 Partager</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={styles.topActionBtn}
                onPress={() => setShowRepostModal(true)}
              >
                <Text style={styles.topActionBtnTxt}>⭐ Avis</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={styles.topActionBtn}
                onPress={() => toggleFullscreen()}
              >
                <Text style={styles.topActionBtnTxt}>{isFullscreen ? '⛶ Réduire' : '⛶ Plein écran'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Zone centrale tactile pour Play/Pause & Contrôles overlay */}
          <Pressable
            style={styles.centerTouchOverlay}
            onPress={handleTogglePlay}
          >
            {!isPlaying && (
              <View style={styles.centerPlayIcon}>
                <Text style={styles.centerPlayIconTxt}>▶</Text>
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
              <Text style={styles.restartTxt}>⏮ Recommencer du début</Text>
            </Pressable>
          )}

          {/* Bouton passer le générique */}
          {showSkipIntro && (
            <Pressable
              focusable={true}
              style={styles.skipIntroBtn}
              onPress={handleSkipIntro}
            >
              <Text style={styles.skipIntroTxt}>⏭ Passer le générique</Text>
            </Pressable>
          )}

          {/* Bannière d'activation audio Android */}
          {audioBlocked && (
            <Pressable style={styles.unmuteBanner} onPress={handleUnmuteGesture}>
              <Text style={styles.unmuteBannerTxt}>🔇 Son désactivé — Appuyez ici pour activer le son 🔊</Text>
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
                  <Text style={styles.nextPlayBtnText}>▶ Lancer maintenant</Text>
                </Pressable>
                <Pressable style={styles.nextCancelBtn} onPress={() => setCountdown(null)}>
                  <Text style={styles.nextCancelBtnText}>Annuler</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Barre inférieure Dépliée (Scrubber & Contrôles) */}
          <View style={[styles.bottomBarExpanded, { opacity: mouseActive || !isPlaying ? 1 : 0 }]}>
            <Pressable style={styles.scrubberExpandedBg} onPress={handleBarClick as any}>
              <View style={[styles.scrubberExpandedFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
            </Pressable>

            <View style={styles.bottomControlsRow}>
              <View style={styles.bottomLeftControls}>
                <Pressable focusable={true} style={styles.controlBtn} onPress={() => handleSeekRelative(-10)}>
                  <Text style={styles.controlBtnTxt}>⏪ 10s</Text>
                </Pressable>

                <Pressable focusable={true} style={styles.playBtn} onPress={handleTogglePlay}>
                  <Text style={styles.playBtnTxt}>{isPlaying ? '⏸' : '▶'}</Text>
                </Pressable>

                <Pressable focusable={true} style={styles.controlBtn} onPress={() => handleSeekRelative(30)}>
                  <Text style={styles.controlBtnTxt}>30s ⏩</Text>
                </Pressable>

                <Text style={styles.timeExpandedText}>
                  {activeMedia?.isLive ? '🔴 Direct' : `${formatTime(pos)} / ${formatTime(dur)}`}
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
                    <Text style={styles.controlBtnTxt}>Suivant ⏭</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </>
      ) : (
        /* 3. MODE REPLIÉ (BARRE FLOTTANTE EN BAS DU SITE) */
        <>
          {/* Barre de progression scrubber interactive */}
          <Pressable style={styles.progressBarBg} onPress={handleBarClick as any}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
          </Pressable>

          <View style={styles.mainRow}>
            {/* Section gauche : Miniature vidéo et Titre (cliquable pour déplier) */}
            <Pressable focusable={true} style={styles.leftSection} onPress={handleExpand}>
              <View style={styles.posterThumb}>
                {posterUri && !activeMedia?.streamUrl ? (
                  <Image source={{ uri: posterUri }} style={styles.posterImg} resizeMode="cover" />
                ) : null}
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
                    : `${formatTime(pos)} / ${formatTime(dur)}`}
                </Text>
              </View>
            </Pressable>

            {/* Section centre : -10s, Play/Pause, +30s */}
            <View style={styles.centerControls}>
              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Reculer de 10 secondes"
                style={styles.controlBtn}
                onPress={() => handleSeekRelative(-10)}
              >
                <Text style={styles.controlBtnTxt}>-10s</Text>
              </Pressable>

              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'}
                style={styles.playBtn}
                onPress={handleTogglePlay}
              >
                <Text style={styles.playBtnTxt}>{isPlaying ? '⏸' : '▶'}</Text>
              </Pressable>

              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Avancer de 30 secondes"
                style={styles.controlBtn}
                onPress={() => handleSeekRelative(30)}
              >
                <Text style={styles.controlBtnTxt}>+30s</Text>
              </Pressable>
            </View>

            {/* Section droite : Options, Déplier ▲, Fermer ✕ */}
            <View style={styles.rightSection}>
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
              >
                <Text style={styles.expandBtnTxt}>▲ Déplier</Text>
              </Pressable>

              <Pressable
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Fermer la lecture"
                style={styles.closeBtn}
                onPress={handleClose}
              >
                <Text style={styles.closeBtnTxt}>✕</Text>
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
          positionSeconds: pos,
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
