import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { sendCastCommand, fetchDeviceStatus, CastDevice } from '@/services/castService';
import { setActiveCastTarget } from '@/services/castState';
import { styles } from './CastControlBar.styles';

const fmt = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export const CastControlBar: React.FC<{ target: CastDevice; onDisconnect?: () => void }> = ({ target, onDisconnect }) => {
  const [device, setDevice] = useState<CastDevice>(target);

  useEffect(() => {
    setDevice(target);
    const interval = setInterval(async () => {
      const live = await fetchDeviceStatus(target.id);
      if (live) setDevice(live);
    }, 1500);
    return () => clearInterval(interval);
  }, [target.id]);

  const togglePlay = async () => {
    const next = !device.isPlaying;
    setDevice((d) => ({ ...d, isPlaying: next }));
    await sendCastCommand(device.id, next ? 'PLAY' : 'PAUSE');
  };

  const seekRelative = async (offset: number) => {
    const nextPos = Math.max(0, Math.min(device.durationSeconds || 7200, device.positionSeconds + offset));
    setDevice((d) => ({ ...d, positionSeconds: nextPos }));
    await sendCastCommand(device.id, 'SEEK', { positionSeconds: nextPos });
  };

  const toggleMute = async () => {
    const nextMute = !device.isMuted;
    setDevice((d) => ({ ...d, isMuted: nextMute }));
    await sendCastCommand(device.id, nextMute ? 'MUTE' : 'UNMUTE');
  };

  const handleStop = async () => {
    await sendCastCommand(device.id, 'STOP');
    setActiveCastTarget(null);
    onDisconnect?.();
  };

  const pct = device.durationSeconds > 0 ? (device.positionSeconds / device.durationSeconds) * 100 : 0;

  return (
    <View style={styles.bar}>
      <View style={styles.topRow}>
        <View style={styles.deviceInfo}>
          <View style={styles.dot} />
          <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
          <Text style={styles.mediaTitle} numberOfLines={1}>• {device.mediaTitle || 'Lecture en cours'}</Text>
        </View>
        <Text style={styles.timeText}>{fmt(device.positionSeconds)} / {fmt(device.durationSeconds)}</Text>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.btnGroup}>
          <Pressable style={styles.btn} onPress={() => seekRelative(-10)}><Text style={styles.btnText}>-10s</Text></Pressable>
          <Pressable style={[styles.btn, styles.primaryBtn]} onPress={togglePlay}>
            <Text style={[styles.btnText, { fontSize: 16 }]}>{device.isPlaying ? '⏸' : '▶'}</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => seekRelative(30)}><Text style={styles.btnText}>+30s</Text></Pressable>
          <Pressable style={styles.btn} onPress={toggleMute}>
            <Text style={styles.btnText}>{device.isMuted ? '🔇' : '🔊'}</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.btn, styles.stopBtn]} onPress={handleStop}>
          <Text style={styles.stopText}>Arrêter</Text>
        </Pressable>
      </View>
    </View>
  );
};
