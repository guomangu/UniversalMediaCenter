import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';
import { sendCastCommand, CastDevice } from '@/services/castService';

interface CastControlBarProps {
  target: CastDevice;
  onDisconnect: () => void;
}

export const CastControlBar: React.FC<CastControlBarProps> = ({ target, onDisconnect }) => {
  const [isPlaying, setIsPlaying] = useState(target.isPlaying);

  const togglePlay = async () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    await sendCastCommand(target.id, nextState ? 'PLAY' : 'PAUSE');
  };

  const handleStop = async () => {
    await sendCastCommand(target.id, 'STOP');
    onDisconnect();
  };

  return (
    <View style={styles.bar}>
      <View style={styles.info}>
        <Text style={styles.badge}>📡 En diffusion</Text>
        <Text style={styles.title} numberOfLines={1}>{target.name}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.btn} onPress={togglePlay}>
          <Text style={styles.btnText}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.stopBtn]} onPress={handleStop}>
          <Text style={styles.stopText}>Arrêter</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    zIndex: 9999,
  },
  info: { flex: 1, marginRight: Spacing.three },
  badge: { fontSize: 11, fontWeight: '700', color: '#818cf8', marginBottom: 2 },
  title: { fontSize: 14, fontWeight: '600', color: '#f8fafc' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  btn: {
    backgroundColor: '#6366f1',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  stopBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    width: 'auto',
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  stopText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
});
