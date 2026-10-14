import React, { useEffect } from 'react';
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
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  id,
  streamUrl,
  isPlaying,
  videoRef,
  showSkipIntro,
  activeSubtitle = 'off',
  activeQuality = 'auto',
  statusMessage,
  onSkipIntro,
  onPlay,
  onPause,
}) => {
  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current?.textTracks) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const isMatch = activeSubtitle && activeSubtitle !== 'off' &&
          tracks[i].language && activeSubtitle.toLowerCase().startsWith(tracks[i].language.toLowerCase());
        tracks[i].mode = isMatch ? 'showing' : 'disabled';
      }
    }
  }, [activeSubtitle]);

  return (
    <View style={styles.videoPlaceholder}>
      {Platform.OS === 'web' ? (
        <video
          ref={videoRef}
          src={streamUrl}
          controls
          autoPlay
          playsInline
          crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
          onPlay={onPlay}
          onPause={onPause}>
          <track
            src={`${getApiBaseUrl()}/api/media/${id}/subtitles?lang=fr`}
            kind="subtitles"
            srcLang="fr"
            label="Français"
            default={activeSubtitle.startsWith('fr')}
          />
          <track
            src={`${getApiBaseUrl()}/api/media/${id}/subtitles?lang=en`}
            kind="subtitles"
            srcLang="en"
            label="English"
            default={activeSubtitle === 'en'}
          />
        </video>
      ) : (
        <>
          <Text style={styles.videoText}>🎬 Flux de Lecture Active</Text>
          <Text style={styles.subText}>
            {isPlaying ? 'Lecture en cours...' : 'En pause'} ({activeQuality.toUpperCase()})
          </Text>
        </>
      )}

      {statusMessage ? (
        <View style={styles.statusToast}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {showSkipIntro && (
        <Pressable style={styles.skipBtn} onPress={onSkipIntro}>
          <Text style={styles.skipText}>⏭ Passer l'introduction (+85s)</Text>
        </Pressable>
      )}
    </View>
  );
};
