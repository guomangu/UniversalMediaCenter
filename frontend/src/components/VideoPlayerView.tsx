import React, { useRef, useEffect, useState } from 'react';
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
}

export const VideoPlayerView: React.FC<Props> = ({
  streamUrl,
  initialTime,
  intro,
  activeSubtitle,
  activeQuality = 'auto',
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
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [curTime, setCurTime] = useState(0);
  const [mouseActive, setMouseActive] = useState(true);
  const [currentCue, setCurrentCue] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const mouseTimer = useRef<any>(null);
  const savedTimeRef = useRef(initialTime || 0);

  const resetMouse = () => {
    setMouseActive(true);
    if (mouseTimer.current) clearTimeout(mouseTimer.current);
    mouseTimer.current = setTimeout(() => setMouseActive(false), 3000);
  };

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      if (Platform.OS === 'web' && videoRef.current) {
        videoRef.current.focus?.();
      }
    }, 150);
    return () => {
      if (mouseTimer.current) clearTimeout(mouseTimer.current);
      clearTimeout(focusTimer);
    };
  }, []);

  // Support HLS Live IPTV universel sur tous les navigateurs (Chrome, Firefox, Safari, Edge)
  useEffect(() => {
    if (Platform.OS !== 'web' || !videoRef.current || !streamUrl) return;
    setPlaybackError(null);
    const v = videoRef.current;
    const Hls = (window as any).Hls;

    if (Hls && Hls.isSupported() && !v.canPlayType('application/vnd.apple.mpegurl')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(v);
      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          const status = data.response?.code;
          if (status === 403 || status === 404) {
            setPlaybackError(`Flux en direct indisponible (Erreur HTTP ${status} : Le diffuseur source restreint ou a interrompu ce flux).`);
          } else {
            setPlaybackError(`Erreur réseau sur le flux en direct (${data.details || 'Diffuseur hors ligne'}).`);
          }
        }
      });
      return () => {
        hls.destroy();
      };
    }
  }, [streamUrl]);

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
    if (target > 0 && videoRef.current && Math.abs(videoRef.current.currentTime - target) > 0.5) videoRef.current.currentTime = target;
    onLoadedMetadata?.();
  };

  const introEnd = intro?.end ?? 90.04;
  const showBtn = showSkipIntro && curTime >= (intro?.start ?? 0) && curTime < introEnd && mouseActive;

  return (
    <View style={styles.videoPlaceholder} onPointerMove={resetMouse}>
      {Platform.OS === 'web' ? (
        <video
          ref={videoRef} src={streamUrl} controls autoPlay playsInline crossOrigin="anonymous"
          tabIndex={0} data-video-player="true"
          style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
          onPlay={onPlay} onPause={onPause}
          onEnded={() => onEnded?.()}
          onError={() => {
            if (!playbackError) {
              setPlaybackError('Flux multimédia temporairement indisponible (Erreur 403 ou diffuseur hors ligne).');
            }
          }}
          onTimeUpdate={() => {
            const t = videoRef.current?.currentTime || 0;
            const d = videoRef.current?.duration || 0;
            setCurTime(t);
            onTimeUpdate?.(t, d);
            if (d > 30 && d - t <= 10) onNearEnd?.(Math.max(0, Math.floor(d - t)));
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

      {/* Alerte informative et bienveillante en cas de flux 403 / indisponible */}
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
        <Pressable focusable={true} style={styles.skipBtn} onPress={onSkipIntro}>
          <Text style={styles.skipText}>⏭ Passer l'introduction ({Math.floor(introEnd)}s)</Text>
        </Pressable>
      )}
    </View>
  );
};
