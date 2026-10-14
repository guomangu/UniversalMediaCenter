import { StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: Spacing.four,
  },
  modal: {
    width: '100%', maxWidth: 440,
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)',
    padding: Spacing.four, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#f8fafc' },
  closeBtn: { padding: Spacing.one },
  closeText: { color: '#94a3b8', fontSize: 16 },
  nativeCastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    marginBottom: 16,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  nativeCastIcon: { fontSize: 28 },
  nativeCastTitle: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  nativeCastSub: { color: '#a5b4fc', fontSize: 11, marginTop: 2 },
  localBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.7)', padding: 10, borderRadius: Radius.md,
    marginBottom: 14, borderWidth: 1, borderColor: 'rgba(51, 65, 85, 0.6)',
  },
  localLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  localName: { color: '#818cf8', fontSize: 13, fontWeight: '700' },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: Radius.pill },
  editBtnTxt: { color: '#a5b4fc', fontSize: 11, fontWeight: '600' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  deviceName: { color: '#f1f5f9', fontWeight: '700', fontSize: 13 },
  deviceSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 6 },
  castPill: {
    backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.pill, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  remotePill: {
    backgroundColor: 'rgba(51, 65, 85, 0.8)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.pill, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  castText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },
  emptyText: { color: '#64748b', fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
});
