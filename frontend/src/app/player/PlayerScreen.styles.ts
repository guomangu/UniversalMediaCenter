import { StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'space-between' },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    margin: Spacing.two,
    borderRadius: Radius.lg,
    position: 'relative',
  },
  videoText: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  subText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  skipBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  skipText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  leftGroup: { flexDirection: 'row', gap: Spacing.two },
  btn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
  },
  btnText: { color: '#f8fafc', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#6366f1' },
  primaryText: { color: '#ffffff', fontWeight: '700' },
  castBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.6)',
  },
  castText: { color: '#818cf8', fontWeight: '700' },
});
