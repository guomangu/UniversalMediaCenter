import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { styles } from '@/components/PlayerScreen.styles';
import { getApiBaseUrl } from '@/services/apiConfig';

interface VideoPlayerViewProps {
  id: string;
  streamUrl: string;
  isPlaying: boolean;
  videoRef: React.RefObject<any>;
  showSkipIntro: boolean;
  activeSubtitle?: string;
  activeQuality?: string;
  statusMessage?: string;
  onSkipIntro: () => void;
  onPlay: () => void;
  onPause: () => void;
  onLoadedMetadata?: () => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  id, streamUrl, isPlaying, videoRef, showSkipIntro,
  activeSubtitle = 'off', activeQuality = 'auto', statusMessage,
  onSkipIntro, onPlay, onPause, onLoadedMetadata,
}) => {
  const [currentCue, setCurrentCue] = useState<string>('');

  const subtitleUrl = React.useMemo(() => {
    if (!activeSubtitle || activeSubtitle === 'off') return '';
    if (activeSubtitle.startsWith('file:')) {
      return `${getApiBaseUrl()}/api/media/${id}/subtitles?fileName=${encodeURIComponent(activeSubtitle.slice(5))}`;
    }
    if (activeSubtitle.startsWith('track:')) {
      return `${getApiBaseUrl()}/api/media/${id}/subtitles?trackIndex=${encodeURIComponent(activeSubtitle.slice(6))}`;
    }
    return `${getApiBaseUrl()}/api/media/${id}/subtitles?lang=${encodeURIComponent(activeSubtitle)}`;
  }, [id, activeSubtitle]);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current?.textTracks) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const tr = tracks[i];
        tr.mode = activeSubtitle !== 'off' ? 'showing' : 'disabled';
        tr.oncuechange = () => {
          setCurrentCue(activeSubtitle !== 'off' && tr.activeCues?.[0]?.text ? tr.activeCues[0].text : '');
        };
      }
      if (!activeSubtitle || activeSubtitle === 'off') setCurrentCue('');
    }
  }, [activeSubtitle, subtitleUrl]);

  return (
    <View style={styles.videoPlaceholder}>
      {Platform.OS === 'web' ? (
        <video
          ref={videoRef} src={streamUrl} controls autoPlay playsInline crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
          onPlay={onPlay} onPause={onPause} onLoadedMetadata={onLoadedMetadata}>
          {subtitleUrl ? (
            <track key={subtitleUrl} src={subtitleUrl} kind="subtitles" default srcLang="fr" label="Actif" />
          ) : null}
        </video>
      ) : (
        <>
          <Text style={styles.videoText}>🎬 Flux de Lecture Active</Text>
          <Text style={styles.subText}>{isPlaying ? 'Lecture en cours...' : 'En pause'} ({activeQuality.toUpperCase()})</Text>
        </>
      )}
      {currentCue && activeSubtitle !== 'off' ? (
        <View style={styles.subtitleOverlay} pointerEvents="none"><Text style={styles.subtitleText}>{currentCue}</Text></View>
      ) : null}
      {statusMessage ? (
        <View style={styles.statusToast} pointerEvents="none"><Text style={styles.statusText}>{statusMessage}</Text></View>
      ) : null}
      {showSkipIntro && (
        <Pressable style={styles.skipBtn} onPress={onSkipIntro}>
          <Text style={styles.skipText}>⏭ Passer l'introduction (+85s)</Text>
        </Pressable>
      )}
    </View>
  );
};
