import { StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'space-between' },
  videoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f172a', margin: Spacing.two, borderRadius: Radius.lg,
    position: 'relative', overflow: 'hidden',
  },
  videoText: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  subText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  skipBtn: {
    position: 'absolute', bottom: 84, right: 24, zIndex: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.92)', paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two, borderRadius: Radius.pill,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  skipText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  controlsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    backgroundColor: 'rgba(15, 23, 42, 0.95)', borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.35)',
    gap: 8, flexWrap: 'wrap',
  },
  leftGroup: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  rightGroup: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.pill, backgroundColor: 'rgba(51, 65, 85, 0.6)',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  btnText: { color: '#f8fafc', fontWeight: '600', fontSize: 12 },
  primaryBtn: { backgroundColor: '#6366f1' },
  primaryText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  castBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)', borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.6)',
  },
  castText: { color: '#818cf8', fontWeight: '700', fontSize: 12 },
});
