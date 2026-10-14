import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { styles } from '@/components/PlayerScreen.styles';

interface VideoPlayerViewProps {
  id: string;
  streamUrl: string;
  isPlaying: boolean;
  videoRef: React.RefObject<any>;
  showSkipIntro: boolean;
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
  onSkipIntro,
  onPlay,
  onPause,
}) => (
  <View style={styles.videoPlaceholder}>
    {Platform.OS === 'web' && streamUrl ? (
      <video
        ref={videoRef}
        src={streamUrl}
        controls
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'contain' }}
        onPlay={onPlay}
        onPause={onPause}
      />
    ) : (
      <>
        <Text style={styles.videoText}>🎬 Flux de Lecture Active</Text>
        <Text style={styles.subText}>Média ID : {id} • {isPlaying ? '▶ En cours' : '⏸ Pause'}</Text>
      </>
    )}

    {showSkipIntro && (
      <Pressable style={styles.skipBtn} onPress={onSkipIntro}>
        <Text style={styles.skipText}>⏭ Passer l'Introduction</Text>
      </Pressable>
    )}
  </View>
);
