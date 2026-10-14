import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Radius } from '@/constants/theme';

interface Props {
  audioUrl: string;
  fileName?: string | null;
}

// Suivi global de l'audio en cours de lecture pour n'en jouer qu'un à la fois
let currentPlayingAudio: HTMLAudioElement | null = null;
let stopCurrentCallback: (() => void) | null = null;

export function InlineAudioPlayer({ audioUrl, fileName }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      const onLoadedMetadata = () => {
        if (!isNaN(audio.duration) && isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      const onTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };

      const onEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('ended', onEnded);

      return () => {
        audio.pause();
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
        if (currentPlayingAudio === audio) {
          currentPlayingAudio = null;
          stopCurrentCallback = null;
        }
      };
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (currentPlayingAudio === audioRef.current) {
        currentPlayingAudio = null;
        stopCurrentCallback = null;
      }
    } else {
      // Mettre en pause le vocal précédent s'il tourne
      if (currentPlayingAudio && currentPlayingAudio !== audioRef.current) {
        currentPlayingAudio.pause();
        stopCurrentCallback?.();
      }

      currentPlayingAudio = audioRef.current;
      stopCurrentCallback = () => setIsPlaying(false);

      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View style={styles.container}>
      <Pressable
        focusable={true}
        onPress={togglePlay}
        style={[styles.playBtn, isPlaying && styles.playingBtn]}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </Pressable>

      <View style={styles.waveCol}>
        <View style={styles.topInfo}>
          <Text style={styles.title} numberOfLines={1}>
            🎙️ {fileName || 'Message vocal'}
          </Text>
          <Text style={styles.timeTxt}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>

        {/* Barre de progression fluide */}
        <View style={styles.track}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: Radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    marginVertical: 4,
    gap: 10,
    maxWidth: 280,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingBtn: {
    backgroundColor: '#ef4444',
  },
  playIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: Platform.OS === 'web' ? 1 : 2,
  },
  waveCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  topInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  timeTxt: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 6,
  },
  track: {
    height: 5,
    backgroundColor: 'rgba(51, 65, 85, 0.7)',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#818cf8',
    borderRadius: 3,
  },
});
