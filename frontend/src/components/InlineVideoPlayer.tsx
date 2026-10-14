import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Radius } from '@/constants/theme';

interface Props {
  videoUrl: string;
  fileName?: string | null;
  onOpenModal: () => void;
}

export function InlineVideoPlayer({ videoUrl, fileName, onOpenModal }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  return (
    <Pressable
      focusable={true}
      onPress={onOpenModal}
      style={styles.container}
    >
      {Platform.OS === 'web' ? (
        // @ts-ignore - HTML5 video autoPlay muted loop in-place
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: '100%',
            maxHeight: 240,
            borderRadius: Radius.md,
            objectFit: 'cover',
            backgroundColor: '#000000',
            display: 'block',
          }}
        />
      ) : (
        <View style={styles.nativeFallback}>
          <Text style={{ fontSize: 28 }}>🎬</Text>
          <Text style={styles.nativeTxt}>{fileName || 'Aperçu vidéo'}</Text>
        </View>
      )}

      {/* Badge interactif invitant à agrandir avec le son */}
      <View style={styles.soundBadge}>
        <Text style={styles.soundBadgeTxt}>🔊 Cliquer pour agrandir avec le son</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
    maxWidth: 380,
    width: '100%',
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  soundBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  soundBadgeTxt: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  nativeFallback: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeTxt: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
  },
});
