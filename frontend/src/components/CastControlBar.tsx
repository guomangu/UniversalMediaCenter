import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { sendCastCommand, fetchDeviceStatus, CastDevice } from '@/services/castService';
import { setActiveCastTarget, disconnectCastTotally } from '@/services/castState';
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

  const pos = device.positionSeconds ?? 0;
  const dur = device.durationSeconds ?? 0;

  const togglePlay = async () => {
    const next = !device.isPlaying;
    setDevice((d) => ({ ...d, isPlaying: next }));
    await sendCastCommand(device.id, next ? 'PLAY' : 'PAUSE');
  };

  const seekRelative = async (offset: number) => {
    const nextPos = Math.max(0, Math.min(dur || 7200, pos + offset));
    setDevice((d) => ({ ...d, positionSeconds: nextPos }));
    await sendCastCommand(device.id, 'SEEK', { positionSeconds: nextPos });
  };

  const handleBarClick = (e: any) => {
    if (Platform.OS !== 'web' || !dur) return;
    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return;
    const clientX =
      typeof e?.clientX === 'number'
        ? e.clientX
        : typeof e?.nativeEvent?.clientX === 'number'
        ? e.nativeEvent.clientX
        : typeof e?.pageX === 'number'
        ? e.pageX
        : typeof e?.nativeEvent?.pageX === 'number'
        ? e.nativeEvent.pageX
        : e?.touches?.[0]?.clientX !== undefined
        ? e.touches[0].clientX
        : e?.nativeEvent?.touches?.[0]?.clientX !== undefined
        ? e.nativeEvent.touches[0].clientX
        : null;
    let ratio: number;
    if (clientX !== null) {
      ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    } else if (typeof e?.nativeEvent?.locationX === 'number') {
      ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / rect.width));
    } else {
      return;
    }
    const target = Math.floor(ratio * dur);
    if (!Number.isFinite(target)) return;
    setDevice((d) => ({ ...d, positionSeconds: target }));
    sendCastCommand(device.id, 'SEEK', { positionSeconds: target });
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      if (window.location.pathname.includes('/player')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekRelative(-10); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekRelative(10); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pos, dur, device.isPlaying]);

  const toggleMute = async () => {
    const nextMute = !device.isMuted;
    setDevice((d) => ({ ...d, isMuted: nextMute }));
    await sendCastCommand(device.id, nextMute ? 'MUTE' : 'UNMUTE');
  };

  const handleStop = async () => {
    await disconnectCastTotally(true);
    onDisconnect?.();
  };

  const pct = dur > 0 ? (pos / dur) * 100 : 0;

  return (
    <View style={styles.bar}>
      <View style={styles.topRow}>
        <View style={styles.deviceInfo}>
          <View style={styles.dot} />
          <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
          <Text style={styles.mediaTitle} numberOfLines={1}>• {device.mediaTitle || 'Lecture en cours'}</Text>
        </View>
        <Text style={styles.timeText}>{fmt(pos)} / {fmt(dur)}</Text>
      </View>
      <Pressable style={styles.progressBarBg} onPress={handleBarClick as any}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
      </Pressable>
      <View style={styles.controlsRow}>
        <View style={styles.btnGroup}>
          <Pressable style={styles.btn} onPress={() => seekRelative(-10)}><Text style={styles.btnText}>-10s</Text></Pressable>
          <Pressable style={[styles.btn, styles.primaryBtn]} onPress={togglePlay}><Text style={[styles.btnText, { fontSize: 16 }]}>{device.isPlaying ? '⏸' : '▶'}</Text></Pressable>
          <Pressable style={styles.btn} onPress={() => seekRelative(30)}><Text style={styles.btnText}>+30s</Text></Pressable>
          <Pressable style={styles.btn} onPress={toggleMute}><Text style={styles.btnText}>{device.isMuted ? '🔇' : '🔊'}</Text></Pressable>
        </View>
        <Pressable style={[styles.btn, styles.stopBtn]} onPress={handleStop}><Text style={styles.stopText}>Arrêter</Text></Pressable>
      </View>
    </View>
  );
};
