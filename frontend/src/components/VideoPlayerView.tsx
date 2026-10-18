import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Hls from 'hls.js';
import { styles } from './PlayerScreen.styles';
import { getApiBaseUrl } from '@/services/apiConfig';

interface Props {
  streamUrl: string;
  initialTime?: number;
  isPlaying?: boolean;
  intro?: { start: number; end: number } | null;
  activeSubtitle?: string;
  activeQuality?: string;
  activeAudio?: string;
  isLive?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null> | ((el: HTMLVideoElement | null) => void);
  onLoadedMetadata?: () => void;
  onTimeUpdate?: (current: number, duration: number) => void;
  onEnded?: () => void;
  onNearEnd?: (remainingSec: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSkipIntro?: () => void;
  showSkipIntro?: boolean;
  showRestartBtn?: boolean;
  onRestartFromBeginning?: () => void;
  statusMessage?: string;
  id?: string;
  isFullscreen?: boolean;
}

export const VideoPlayerView: React.FC<Props> = ({
  streamUrl,
  initialTime,
  intro,
  activeSubtitle = 'off',
  activeQuality = 'auto',
  activeAudio = 'auto',
  isLive = false,
  isPlaying = true,
  videoRef: externalVideoRef,
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
  onNearEnd,
  onPlay,
  onPause,
  onSkipIntro,
  showSkipIntro = false,
  showRestartBtn = false,
  onRestartFromBeginning,
  statusMessage,
  id = '',
  isFullscreen = false,
}) => {
  const innerVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<any>(null);
  const userPausedRef = useRef(!isPlaying);
  const [mouseActive, setMouseActive] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const handleUnmuteGesture = () => {
    const v = innerVideoRef.current;
    if (v) {
      if (v.muted) {
        v.muted = false;
        v.volume = 1;
      }
      setAudioBlocked(false);
    }
  };

  const mouseTimer = useRef<any>(null);
  const lastTimeRef = useRef<number>(initialTime || 0);
  const pendingAudioSeekRef = useRef<number | null>(null);
  const initialSeekDoneRef = useRef(false);
  const prevStreamUrlRef = useRef<string>(streamUrl);

  // Conserver la position précise lors d'un changement de flux (ex: sélection d'une piste audio)
  useEffect(() => {
    if (prevStreamUrlRef.current && prevStreamUrlRef.current !== streamUrl) {
      const currentPos = innerVideoRef.current?.currentTime || lastTimeRef.current;
      if (currentPos > 0) {
        pendingAudioSeekRef.current = currentPos;
      }
      initialSeekDoneRef.current = false;
    }
    prevStreamUrlRef.current = streamUrl;
  }, [streamUrl]);

  useEffect(() => {
    initialSeekDoneRef.current = false;
  }, [id]);

  const setVideoRef = (el: HTMLVideoElement | null) => {
    innerVideoRef.current = el;
    if (el) {
      el.muted = false;
      el.volume = 1;
    }
    if (externalVideoRef) {
      if (typeof externalVideoRef === 'function') {
        externalVideoRef(el);
      } else if ('current' in externalVideoRef) {
        externalVideoRef.current = el;
      }
    }
  };

  // Le son du média doit toujours être actif par défaut à 100%
  useEffect(() => {
    const v = innerVideoRef.current;
    if (v) {
      v.muted = false;
      v.volume = 1;
    }
  }, [streamUrl, activeAudio]);

  useEffect(() => {
    if (!isLive && initialTime && initialTime > 0 && !initialSeekDoneRef.current) {
      lastTimeRef.current = initialTime;
      if (innerVideoRef.current && innerVideoRef.current.readyState >= 1) {
        innerVideoRef.current.currentTime = initialTime;
        initialSeekDoneRef.current = true;
      }
    }
  }, [initialTime, isLive]);

  const resetMouse = () => {
    setMouseActive(true);
    if (mouseTimer.current) clearTimeout(mouseTimer.current);
    mouseTimer.current = setTimeout(() => {
      setMouseActive(false);
    }, 3500);
  };

  useEffect(() => {
    resetMouse();
    return () => {
      if (mouseTimer.current) clearTimeout(mouseTimer.current);
    };
  }, []);

  const isHlsStream = useMemo(() => {
    if (!streamUrl) return false;
    return Boolean(isLive || streamUrl.includes('.m3u8') || streamUrl.includes('/iptv/'));
  }, [isLive, streamUrl]);

  const shouldUseHlsJs = useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !isHlsStream) return false;
    return Boolean(Hls.isSupported());
  }, [isHlsStream]);

  // Initialisation et gestion fine de la lecture HLS.js
  useEffect(() => {
    if (!shouldUseHlsJs || !streamUrl) return;
    const v = innerVideoRef.current;
    if (!v) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 6,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 6,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 6,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
        maxFragLookUpTolerance: 0.25,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        v.muted = false;
        v.volume = 1;
        if (!isLive && initialTime && initialTime > 0 && !initialSeekDoneRef.current) {
          v.currentTime = initialTime;
          initialSeekDoneRef.current = true;
        }
        if (!userPausedRef.current && isPlaying !== false) {
          const playPromise = v.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              if (err.name === 'NotAllowedError') {
                v.muted = true;
                setAudioBlocked(true);
                v.play().catch(() => {});
                const enableAudio = () => {
                  if (innerVideoRef.current) {
                    innerVideoRef.current.muted = false;
                    innerVideoRef.current.volume = 1;
                  }
                  setAudioBlocked(false);
                  window.removeEventListener('click', enableAudio);
                  window.removeEventListener('touchend', enableAudio);
                };
                window.addEventListener('click', enableAudio, { once: true });
                window.addEventListener('touchend', enableAudio, { once: true });
              }
            });
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (!data.fatal) {
          if (data.details === 'bufferStalledError') {
            if (!userPausedRef.current && v.paused && isPlaying !== false) {
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
            if (!userPausedRef.current && v.paused && isPlaying !== false) {
              v.play().catch(() => {});
            }
            break;
          default:
            const status = data.response?.code;
            if (status === 403 || status === 404 || status === 502 || status === 504) {
              setPlaybackError(
                `Flux en direct indisponible (${
                  status === 502 || status === 403
                    ? 'Le diffuseur source a restreint ou interrompu ce flux'
                    : `Erreur HTTP ${status}`
                }).`
              );
            } else {
              setPlaybackError(
                `Erreur réseau sur le flux en direct (${data.details || 'Diffuseur hors ligne'}).`
              );
            }
            hls.destroy();
            break;
        }
      });

      return () => {
        hls.destroy();
      };
    }
  }, [streamUrl, shouldUseHlsJs]);

  // Synchronisation univoque de Play/Pause sans détruire ni réinitialiser HLS
  useEffect(() => {
    const v = innerVideoRef.current;
    if (!v) return;
    if (isPlaying && v.paused) {
      userPausedRef.current = false;
      v.play().catch(() => {});
    } else if (!isPlaying && !v.paused) {
      userPausedRef.current = true;
      v.pause();
    }
  }, [isPlaying]);

  const subtitleUrl = useMemo(() => {
    if (!activeSubtitle || activeSubtitle === 'off') return '';
    if (activeSubtitle.startsWith('file:')) return `${getApiBaseUrl()}/api/media/${id}/subtitles?fileName=${encodeURIComponent(activeSubtitle.slice(5))}`;
    if (activeSubtitle.startsWith('track:')) return `${getApiBaseUrl()}/api/media/${id}/subtitles?trackIndex=${encodeURIComponent(activeSubtitle.slice(6))}`;
    return `${getApiBaseUrl()}/api/media/${id}/subtitles?lang=${encodeURIComponent(activeSubtitle)}`;
  }, [id, activeSubtitle]);

  // Synchronisation stricte de la piste de sous-titres native (mode 'showing' en fenêtre et plein écran)
  useEffect(() => {
    const v = innerVideoRef.current;
    if (!v) return;

    const syncTracks = () => {
      if (!v.textTracks) return;
      for (let i = 0; i < v.textTracks.length; i++) {
        const t = v.textTracks[i];
        if (activeSubtitle === 'off' || !subtitleUrl) {
          t.mode = 'disabled';
        } else {
          t.mode = 'showing';
        }
      }
    };

    syncTracks();
    const tt = v.textTracks;
    if (tt && tt.addEventListener) {
      tt.addEventListener('addtrack', syncTracks);
      tt.addEventListener('change', syncTracks);
      return () => {
        tt.removeEventListener('addtrack', syncTracks);
        tt.removeEventListener('change', syncTracks);
      };
    }
  }, [activeSubtitle, subtitleUrl]);

  const handleLoaded = () => {
    const v = innerVideoRef.current;
    if (v) {
      v.muted = false;
      v.volume = 1;
    }
    if (!isLive) {
      const seekTarget = pendingAudioSeekRef.current ?? (initialTime && initialTime > 0 && !initialSeekDoneRef.current ? initialTime : null);
      if (seekTarget !== null && seekTarget > 0 && v) {
        if (Math.abs(v.currentTime - seekTarget) > 0.5) {
          v.currentTime = seekTarget;
        }
        pendingAudioSeekRef.current = null;
        initialSeekDoneRef.current = true;
      }
    }
    if (v?.paused && !userPausedRef.current && isPlaying !== false) {
      v.play().catch(() => {});
    }
    onLoadedMetadata?.();
  };

  const handleCanPlay = () => {
    const v = innerVideoRef.current;
    if (v) {
      v.muted = false;
      v.volume = 1;
    }
    if (!isLive) {
      const seekTarget = pendingAudioSeekRef.current ?? (initialTime && initialTime > 0 && !initialSeekDoneRef.current ? initialTime : null);
      if (seekTarget !== null && seekTarget > 0 && v) {
        if (Math.abs(v.currentTime - seekTarget) > 0.5) {
          v.currentTime = seekTarget;
        }
        pendingAudioSeekRef.current = null;
        initialSeekDoneRef.current = true;
      }
    }
    if (v?.paused && !userPausedRef.current && isPlaying !== false) {
      v.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    const v = innerVideoRef.current;
    const t = v?.currentTime || 0;
    const d = v?.duration || 0;
    if (t > 0) {
      lastTimeRef.current = t;
    }

    onTimeUpdate?.(t, d);
    if (!isLive && Number.isFinite(d) && d > 30 && d - t <= 10) {
      onNearEnd?.(Math.max(0, Math.floor(d - t)));
    }
  };

  return (
    <View
      ref={containerRef as any}
      {...({ dataSet: { playerContainer: 'true', focusable: 'false' }, tabIndex: -1 } as any)}
      style={[styles.videoPlaceholder, { backgroundColor: '#000000' }]}
      onPointerMove={resetMouse}
      onPointerDown={handleUnmuteGesture}
      onTouchEnd={handleUnmuteGesture}
    >
      {Platform.OS === 'web' ? (
        <video
          ref={setVideoRef}
          src={shouldUseHlsJs ? undefined : streamUrl}
          controls
          autoPlay
          playsInline
          muted={false}
          crossOrigin="anonymous"
          tabIndex={-1}
          data-video-player="true"
          style={{ width: '100%', height: '100%', backgroundColor: '#000000', borderRadius: 0, objectFit: 'contain' }}
          onFocus={() => {
            containerRef.current?.focus?.();
          }}
          onPlay={() => {
            userPausedRef.current = false;
            setPlaybackError(null);
            if (innerVideoRef.current && innerVideoRef.current.muted) {
              innerVideoRef.current.muted = false;
              innerVideoRef.current.volume = 1;
              setAudioBlocked(false);
            }
            onPlay?.();
          }}
          onPause={() => {
            userPausedRef.current = true;
            onPause?.();
          }}
          onCanPlay={handleCanPlay}
          onSeeking={() => {
            initialSeekDoneRef.current = true;
          }}
          onSeeked={() => {
            initialSeekDoneRef.current = true;
            handleTimeUpdate();
          }}
          onWaiting={() => {
            if (isLive && innerVideoRef.current?.paused && !userPausedRef.current && isPlaying !== false) {
              innerVideoRef.current.play().catch(() => {});
            }
          }}
          onEnded={() => {
            if (!isLive) {
              onEnded?.();
            } else if (innerVideoRef.current && !userPausedRef.current && isPlaying !== false) {
              innerVideoRef.current.play().catch(() => {});
            }
          }}
          onError={() => {
            if (!playbackError && !isLive) {
              setPlaybackError('Flux multimédia temporairement indisponible (Erreur diffuseur ou encodage).');
            }
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoaded}
        >
          {subtitleUrl && activeSubtitle !== 'off' ? (
            <track
              key={subtitleUrl}
              kind="subtitles"
              src={subtitleUrl}
              srcLang="fr"
              label="Sous-titres"
              default
            />
          ) : null}
        </video>
      ) : (
        <Text style={styles.videoText}>🎬 Lecture ({activeQuality.toUpperCase()})</Text>
      )}

      {/* Alerte informative en cas de flux indisponible */}
      {playbackError ? (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.95)', padding: 24, alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📡</Text>
          <Text style={{ color: '#f8fafc', fontWeight: '800', fontSize: 16, marginBottom: 6, textAlign: 'center' }}>
            Diffusion En Direct Indisponible
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', maxWidth: 440, lineHeight: 18, marginBottom: 16 }}>
            {playbackError}
          </Text>
          <Pressable
            focusable={true}
            style={{ backgroundColor: '#4f46e5', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.back();
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>← Choisir une autre chaîne</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Bannière d'activation audio Android / Mobile Autoplay */}
      {audioBlocked && (
        <Pressable
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Activer le son"
          onPress={handleUnmuteGesture}
          style={{
            position: 'absolute',
            top: 70,
            alignSelf: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderWidth: 1.5,
            borderColor: '#E5A00D',
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 24,
            zIndex: 99,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 20 }}>🔇</Text>
          <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 13 }}>
            Son désactivé — Appuyez ici pour activer le son 🔊
          </Text>
        </Pressable>
      )}

      {/* Message de statut optionnel */}
      {statusMessage && !playbackError && (
        <View style={styles.statusToast}>
          <Text style={styles.statusToastText}>{statusMessage}</Text>
        </View>
      )}
    </View>
  );
};
