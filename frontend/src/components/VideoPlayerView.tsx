import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { styles } from '@/components/PlayerScreen.styles';
import { getApiBaseUrl } from '@/services/apiConfig';

interface VideoPlayerViewProps {
  id: string;
  streamUrl: string;
  isPlaying: boolean;
  videoRef: React.RefObject<any>;
  showSkipIntro: boolean;
  intro?: { start: number; end: number };
  activeSubtitle?: string;
  activeQuality?: string;
  activeAudio?: string;
  statusMessage?: string;
  onSkipIntro: () => void;
  onPlay: () => void;
  onPause: () => void;
  onLoadedMetadata?: () => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  id, streamUrl, isPlaying, videoRef, showSkipIntro, intro,
  activeSubtitle = 'off', activeQuality = 'auto', activeAudio = 'auto', statusMessage,
  onSkipIntro, onPlay, onPause, onLoadedMetadata,
}) => {
  const [currentCue, setCurrentCue] = useState('');
  const [curTime, setCurTime] = useState(0);
  const [mouseActive, setMouseActive] = useState(true);
  const savedTimeRef = useRef(0);
  const mouseTimer = useRef<any>(null);

  const resetMouse = () => {
    setMouseActive(true);
    if (mouseTimer.current) clearTimeout(mouseTimer.current);
    mouseTimer.current = setTimeout(() => setMouseActive(false), 5000);
  };

  useEffect(() => {
    resetMouse();
    return () => { if (mouseTimer.current) clearTimeout(mouseTimer.current); };
  }, []);

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
        const tr = tracks[i];
        tr.mode = activeSubtitle !== 'off' ? 'showing' : 'disabled';
        tr.oncuechange = () => setCurrentCue(activeSubtitle !== 'off' && tr.activeCues?.[0]?.text ? tr.activeCues[0].text : '');
      }
      if (!activeSubtitle || activeSubtitle === 'off') setCurrentCue('');
    }
  }, [activeSubtitle, subtitleUrl]);

  const introEnd = intro?.end ?? 90.04;
  const inIntro = curTime >= (intro?.start ?? 0) && curTime < introEnd;
  const showBtn = showSkipIntro && inIntro && mouseActive;

  return (
    <View style={styles.videoPlaceholder} onPointerMove={resetMouse}>
      {Platform.OS === 'web' ? (
        <video
          ref={videoRef} src={streamUrl} controls autoPlay playsInline crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
          onPlay={onPlay} onPause={onPause}
          onTimeUpdate={() => {
            const t = videoRef.current?.currentTime || 0;
            savedTimeRef.current = t;
            setCurTime(t);
          }}
          onLoadedMetadata={() => {
            if (savedTimeRef.current > 0 && videoRef.current) videoRef.current.currentTime = savedTimeRef.current;
            onLoadedMetadata?.();
          }}>
          {subtitleUrl ? <track key={subtitleUrl} src={subtitleUrl} kind="subtitles" default srcLang="fr" label="Actif" /> : null}
        </video>
      ) : (
        <Text style={styles.videoText}>🎬 Lecture ({activeQuality.toUpperCase()})</Text>
      )}
      {currentCue && activeSubtitle !== 'off' ? <View style={styles.subtitleOverlay} pointerEvents="none"><Text style={styles.subtitleText}>{currentCue}</Text></View> : null}
      {statusMessage ? <View style={styles.statusToast} pointerEvents="none"><Text style={styles.statusText}>{statusMessage}</Text></View> : null}
      {showBtn && (
        <Pressable focusable={true} style={styles.skipBtn} onPress={onSkipIntro}>
          <Text style={styles.skipText}>⏭ Passer l'introduction ({Math.floor(introEnd)}s)</Text>
        </Pressable>
      )}
    </View>
  );
};
