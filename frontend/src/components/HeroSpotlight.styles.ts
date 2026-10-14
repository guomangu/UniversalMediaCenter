import { StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    height: 380, width: '100%', position: 'relative',
    marginBottom: Spacing.four, borderRadius: Radius.lg,
    overflow: 'hidden', backgroundColor: '#0f172a',
  },
  containerMobile: { height: 260, borderRadius: Radius.md },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end', padding: Spacing.four,
  },
  overlayMobile: { padding: Spacing.three },
  badgeRow: { flexDirection: 'row', marginBottom: Spacing.one },
  title: { fontSize: 26, fontWeight: '800', color: '#ffffff', marginBottom: Spacing.half },
  titleMobile: { fontSize: 20 },
  tagline: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginBottom: Spacing.one },
  overview: { fontSize: 13, color: '#cbd5e1', lineHeight: 18, maxWidth: 600, marginBottom: Spacing.three },
  overviewMobile: { fontSize: 12, lineHeight: 16, marginBottom: Spacing.two },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  playBtn: { backgroundColor: '#6366f1', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Radius.pill },
  playText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  detailBtn: { backgroundColor: 'rgba(51, 65, 85, 0.7)', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.2)' },
  detailText: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  btnPressed: { opacity: 0.75 },
});
