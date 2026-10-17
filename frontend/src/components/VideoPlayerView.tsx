import Hls from 'hls.js';
import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import { styles } from './PlayerScreen.styles';
import { getApiBaseUrl } from '@/services/apiConfig';

interface Props {
  streamUrl: string;
  initialTime?: number;
  intro?: { start: number; end: number } | null;
  activeSubtitle?: string;
  activeQuality?: string;
  activeAudio?: string;
  isPlaying?: boolean;
  isLive?: boolean;
  videoRef?: any;
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

const VideoPlayerViewComponent: React.FC<Props> = ({
  streamUrl,
  initialTime,
  intro,
  activeSubtitle,
  activeQuality = 'auto',
  isLive = false,
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
  const userPausedRef = useRef(false);
  const [curTime, setCurTime] = useState(0);
  const [mouseActive, setMouseActive] = useState(true);
  const [currentCue, setCurrentCue] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const mouseTimer = useRef<any>(null);
  const savedTimeRef = useRef(initialTime || 0);
  const initialSeekDoneRef = useRef(false);

  useEffect(() => {
    initialSeekDoneRef.current = false;
  }, [id, streamUrl]);

  const setVideoRef = (el: HTMLVideoElement | null) => {
    innerVideoRef.current = el;
    if (externalVideoRef) {
      if (typeof externalVideoRef === 'function') {
        externalVideoRef(el);
      } else if ('current' in externalVideoRef) {
        externalVideoRef.current = el;
      }
    }
  };

  useEffect(() => {
    if (!isLive && initialTime && initialTime > 0 && !initialSeekDoneRef.current) {
      savedTimeRef.current = initialTime;
      if (innerVideoRef.current && innerVideoRef.current.readyState >= 1) {
        innerVideoRef.current.currentTime = initialTime;
        initialSeekDoneRef.current = true;
      }
    }
  }, [initialTime, isLive]);

  const resetMouse = () => {
    setMouseActive(true);
    if (mouseTimer.current) clearTimeout(mouseTimer.current);
    mouseTimer.current = setTimeout(() => setMouseActive(false), 3000);
  };

  useEffect(() => {
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

  // Support HLS Live IPTV résilient sur tous les navigateurs avec auto-recovery et buffer anti-décrochage
  useEffect(() => {
    if (Platform.OS !== 'web' || !innerVideoRef.current || !streamUrl || !shouldUseHlsJs) return;
    setPlaybackError(null);
    const v = innerVideoRef.current;

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
        if (!userPausedRef.current) {
          const playPromise = v.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              if (err.name === 'NotAllowedError') {
                v.muted = true;
                v.play().catch(() => {});
              }
            });
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (!data.fatal) {
          if (data.details === 'bufferStalledError') {
            if (!userPausedRef.current && v.paused) {
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
            if (!userPausedRef.current && v.paused) {
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

  const subtitleUrl = React.useMemo(() => {
    if (!activeSubtitle || activeSubtitle === 'off') return '';
    if (activeSubtitle.startsWith('file:')) return `${getApiBaseUrl()}/api/media/${id}/subtitles?fileName=${encodeURIComponent(activeSubtitle.slice(5))}`;
    if (activeSubtitle.startsWith('track:')) return `${getApiBaseUrl()}/api/media/${id}/subtitles?trackIndex=${encodeURIComponent(activeSubtitle.slice(6))}`;
    return `${getApiBaseUrl()}/api/media/${id}/subtitles?lang=${encodeURIComponent(activeSubtitle)}`;
  }, [id, activeSubtitle]);

  useEffect(() => {
    if (Platform.OS === 'web' && innerVideoRef.current?.textTracks) {
      const tracks = innerVideoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = activeSubtitle !== 'off' ? 'showing' : 'disabled';
        tracks[i].oncuechange = () => {
          const cue = (tracks[i].activeCues?.[0] as any)?.text;
          setCurrentCue(activeSubtitle !== 'off' && cue ? cue : '');
        };
      }
      if (!activeSubtitle || activeSubtitle === 'off') setCurrentCue('');
    }
  }, [activeSubtitle, subtitleUrl]);

  const handleLoaded = () => {
    if (!isLive && !initialSeekDoneRef.current) {
      const target = initialTime && initialTime > 0 ? initialTime : savedTimeRef.current;
      if (target > 0 && innerVideoRef.current && Math.abs(innerVideoRef.current.currentTime - target) > 0.5) {
        innerVideoRef.current.currentTime = target;
        initialSeekDoneRef.current = true;
      }
    }
    onLoadedMetadata?.();
  };

  const introEnd = intro?.end ?? 90.04;
  const showBtn = !isLive && !isFullscreen && showSkipIntro && curTime <= 10;

  return (
    <View
      ref={containerRef as any}
      {...({ dataSet: { playerContainer: 'true', focusable: 'false' }, tabIndex: -1 } as any)}
      style={styles.videoPlaceholder}
      onPointerMove={resetMouse}
    >
      {Platform.OS === 'web' ? (
        <video
          ref={setVideoRef}
          src={shouldUseHlsJs ? undefined : streamUrl}
          controls
          autoPlay
          playsInline
          crossOrigin="anonymous"
          tabIndex={-1}
          data-video-player="true"
          style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
          onFocus={() => {
            containerRef.current?.focus?.();
          }}
          onPlay={() => {
            userPausedRef.current = false;
            setPlaybackError(null);
            onPlay?.();
          }}
          onPause={() => {
            userPausedRef.current = true;
            onPause?.();
          }}
          onCanPlay={() => {
            if (!isLive && !initialSeekDoneRef.current) {
              const target = initialTime && initialTime > 0 ? initialTime : savedTimeRef.current;
              if (target > 0 && innerVideoRef.current && Math.abs(innerVideoRef.current.currentTime - target) > 0.5) {
                innerVideoRef.current.currentTime = target;
                initialSeekDoneRef.current = true;
              }
            }
            if (innerVideoRef.current?.paused && !userPausedRef.current) {
              innerVideoRef.current.play().catch(() => {});
            }
          }}
          onSeeking={() => {
            initialSeekDoneRef.current = true;
          }}
          onSeeked={() => {
            initialSeekDoneRef.current = true;
            const t = innerVideoRef.current?.currentTime || 0;
            const d = innerVideoRef.current?.duration || 0;
            setCurTime(t);
            onTimeUpdate?.(t, d);
          }}
          onWaiting={() => {
            if (isLive && innerVideoRef.current?.paused && !userPausedRef.current) {
              innerVideoRef.current.play().catch(() => {});
            }
          }}
          onEnded={() => {
            if (!isLive) {
              onEnded?.();
            } else if (innerVideoRef.current && !userPausedRef.current) {
              innerVideoRef.current.play().catch(() => {});
            }
          }}
          onError={() => {
            if (!playbackError && !isLive) {
              setPlaybackError('Flux multimédia temporairement indisponible (Erreur diffuseur ou lien expiré).');
            }
          }}
          onTimeUpdate={() => {
            const t = innerVideoRef.current?.currentTime || 0;
            const d = innerVideoRef.current?.duration || 0;
            setCurTime(t);
            onTimeUpdate?.(t, d);
            if (!isLive && Number.isFinite(d) && d > 30 && d - t <= 10) {
              onNearEnd?.(Math.max(0, Math.floor(d - t)));
            }
          }}
          onLoadedMetadata={handleLoaded}
        >
          {subtitleUrl ? (
            <track
              kind="subtitles"
              src={subtitleUrl}
              srcLang={activeSubtitle}
              label={activeSubtitle}
              default
            />
          ) : null}
        </video>
      ) : (
        <Text style={styles.videoText}>🎬 Lecture ({activeQuality.toUpperCase()})</Text>
      )}

      {/* Alerte informative en cas de flux indisponible */}
      {playbackError ? (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.92)', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📡</Text>
          <Text style={{ color: '#f8fafc', fontWeight: '800', fontSize: 16, marginBottom: 6, textAlign: 'center' }}>
            Diffusion En Direct Indisponible
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', maxWidth: 440, lineHeight: 18, marginBottom: 16 }}>
            {playbackError}
          </Text>
          <Pressable
            focusable={true}
            style={{ backgroundColor: '#6366f1', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.back();
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>← Choisir une autre chaîne</Text>
          </Pressable>
        </View>
      ) : null}

      {currentCue && activeSubtitle !== 'off' ? (
        <View style={styles.subtitleOverlay} pointerEvents="none">
          <Text style={styles.subtitleText}>{currentCue}</Text>
        </View>
      ) : null}
      {statusMessage ? (
        <View style={styles.statusToast} pointerEvents="none">
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}
      {showRestartBtn && !isLive && (
        <Pressable
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Recommencer depuis le début"
          {...({ dataSet: { restartBeginning: 'true', focusable: 'true' } } as any)}
          onPress={onRestartFromBeginning}
          style={({ focused }: any) => [styles.restartBtn, focused && styles.restartBtnFocused]}
        >
          <Text style={styles.restartBtnIcon}>⏮️</Text>
          <Text style={styles.restartBtnText}>Recommencer depuis le début</Text>
        </Pressable>
      )}
      {showBtn && (
        <Pressable
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Passer l'intro"
          {...({ dataSet: { skipIntro: 'true', focusable: 'true' } } as any)}
          onPress={onSkipIntro}
          style={({ focused }: any) => [styles.skipBtn, focused && styles.skipBtnFocused]}
        >
          <Text style={styles.skipText}>Passer l'intro ⏩</Text>
        </Pressable>
      )}
    </View>
  );
};

export const VideoPlayerView = memo(VideoPlayerViewComponent);
