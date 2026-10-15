import React, { useRef, useEffect, useState, useMemo } from 'react';
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
  statusMessage?: string;
  id?: string;
  isFullscreen?: boolean;
}

export const VideoPlayerView: React.FC<Props> = ({
  streamUrl,
  initialTime,
  intro,
  activeSubtitle,
  activeQuality = 'auto',
  isLive = false,
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
  onNearEnd,
  onPlay,
  onPause,
  onSkipIntro,
  showSkipIntro = false,
  statusMessage,
  id = '',
  isFullscreen = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const [curTime, setCurTime] = useState(0);
  const [mouseActive, setMouseActive] = useState(true);
  const [currentCue, setCurrentCue] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const mouseTimer = useRef<any>(null);
  const savedTimeRef = useRef(initialTime || 0);

  useEffect(() => {
    if (initialTime && initialTime > 0) {
      savedTimeRef.current = initialTime;
      if (videoRef.current && Math.abs(videoRef.current.currentTime - initialTime) > 1) {
        videoRef.current.currentTime = initialTime;
      }
    }
  }, [initialTime]);

  const resetMouse = () => {
    setMouseActive(true);
    if (mouseTimer.current) clearTimeout(mouseTimer.current);
    mouseTimer.current = setTimeout(() => setMouseActive(false), 3000);
  };

  useEffect(() => {
    // Ne pas forcer le focus sur la vidéo brute car cela piège les touches du clavier
    // dans la barre de progression native du navigateur.
    return () => {
      if (mouseTimer.current) clearTimeout(mouseTimer.current);
    };
  }, []);

  const isHlsStream = useMemo(() => {
    if (!streamUrl) return false;
    return isLive || streamUrl.includes('.m3u8') || streamUrl.includes('/stream/') || streamUrl.includes('iptv');
  }, [isLive, streamUrl]);

  const shouldUseHlsJs = useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !isHlsStream) return false;
    const v = document.createElement('video');
    const canPlayNative = Boolean(v.canPlayType('application/vnd.apple.mpegurl'));
    const Hls = (window as any).Hls;
    return Boolean(Hls?.isSupported() && !canPlayNative);
  }, [isHlsStream]);

  // Support HLS Live IPTV résilient sur tous les navigateurs avec auto-recovery et buffer anti-décrochage
  useEffect(() => {
    if (Platform.OS !== 'web' || !videoRef.current || !streamUrl || !shouldUseHlsJs) return;
    setPlaybackError(null);
    const v = videoRef.current;
    const Hls = (window as any).Hls;

    if (Hls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 6,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 8,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!userPausedRef.current) {
          v.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
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
    if (Platform.OS === 'web' && videoRef.current?.textTracks) {
      const tracks = videoRef.current.textTracks;
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
    const target = initialTime && initialTime > 0 ? initialTime : savedTimeRef.current;
    if (target > 0 && videoRef.current && Math.abs(videoRef.current.currentTime - target) > 0.5) {
      videoRef.current.currentTime = target;
    }
    onLoadedMetadata?.();
  };

  const introEnd = intro?.end ?? 90.04;
  // Le bouton "Passer l'intro" reste accessible pendant toute la durée du générique,
  // y compris lors de la navigation au clavier ou à la télécommande sans souris
  const showBtn = !isFullscreen && showSkipIntro && curTime >= (intro?.start ?? 0) && curTime < introEnd;

  return (
    <View style={styles.videoPlaceholder} onPointerMove={resetMouse} data-player-container="true">
      {Platform.OS === 'web' ? (
        <video
          ref={videoRef}
          src={shouldUseHlsJs ? undefined : streamUrl}
          controls
          autoPlay
          playsInline
          crossOrigin="anonymous"
          tabIndex={-1}
          data-video-player="true"
          style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
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
            if (videoRef.current?.paused && !userPausedRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onEnded={() => {
            if (!isLive) {
              onEnded?.();
            } else if (videoRef.current && !userPausedRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onError={() => {
            if (!playbackError && !isLive) {
              setPlaybackError('Flux multimédia temporairement indisponible (Erreur diffuseur ou lien expiré).');
            }
          }}
          onTimeUpdate={() => {
            const t = videoRef.current?.currentTime || 0;
            const d = videoRef.current?.duration || 0;
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
      {showBtn && (
        <Pressable
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Passer l'intro"
          data-skip-intro="true"
          data-focusable="true"
          onPress={onSkipIntro}
          style={({ focused }: any) => [styles.skipBtn, focused && styles.skipBtnFocused]}
        >
          <Text style={styles.skipText}>Passer l'intro ⏩</Text>
        </Pressable>
      )}
    </View>
  );
};
