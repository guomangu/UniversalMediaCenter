import { StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  bar: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four, paddingVertical: Spacing.three,
    flexDirection: 'column', gap: 8,
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.5)',
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 16px rgba(0, 0, 0, 0.5)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 }),
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  deviceName: { color: '#818cf8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  mediaTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '600', maxWidth: 240 },
  timeText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  progressBarBg: {
    height: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2, overflow: 'hidden', width: '100%',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  progressBarFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 2 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btnGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  primaryBtn: {
    backgroundColor: '#6366f1', width: 38, height: 38,
    borderRadius: 19, paddingHorizontal: 0, paddingVertical: 0,
  },
  btnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  stopBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill,
  },
  stopText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
});
