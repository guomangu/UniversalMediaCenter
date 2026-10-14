import React, { useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { styles } from '@/components/PlayerScreen.styles';

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
    if (Platform.OS === 'web' && videoRef.current) {
      const tracks = videoRef.current.textTracks;
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          const tr = tracks[i];
          if (!activeSubtitle || activeSubtitle === 'off') {
            tr.mode = 'disabled';
          } else if (tr.language && activeSubtitle.toLowerCase().startsWith(tr.language.toLowerCase())) {
            tr.mode = 'showing';
          } else {
            tr.mode = 'disabled';
          }
        }
      }
    }
  }, [activeSubtitle]);

  return (
    <View style={styles.videoPlaceholder}>
      {statusMessage ? (
        <View style={styles.statusToast}><Text style={styles.statusText}>{statusMessage}</Text></View>
      ) : null}

      {Platform.OS === 'web' && streamUrl ? (
        <video
          ref={videoRef}
          key={`${streamUrl}-${activeQuality}`}
          src={streamUrl}
          controls
          autoPlay
          playsInline
          crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
          onPlay={onPlay}
          onPause={onPause}>
          <track
            src={`http://localhost:3000/api/media/${id}/subtitles?lang=fr`}
            kind="subtitles"
            srcLang="fr"
            label="Français"
            default={activeSubtitle.startsWith('fr')}
          />
          <track
            src={`http://localhost:3000/api/media/${id}/subtitles?lang=en`}
            kind="subtitles"
            srcLang="en"
            label="English"
            default={activeSubtitle === 'en'}
          />
        </video>
      ) : (
        <>
          <Text style={styles.videoText}>🎬 Flux de Lecture Active</Text>
          <Text style={styles.subText}>Média ID : {id} • {isPlaying ? '▶ En cours' : '⏸ Pause'}</Text>
        </>
      )}

      {showSkipIntro && (
        <Pressable style={styles.skipBtn} onPress={onSkipIntro}>
          <Text style={styles.skipText}>⏩ Passer l'Introduction (+85s)</Text>
        </Pressable>
      )}
    </View>
  );
};
