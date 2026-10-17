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
    zIndex: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#f8fafc' },
  closeBtn: { padding: Spacing.one },
  closeText: { color: '#94a3b8', fontSize: 16 },

  // Notice info / warning
  infoBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  infoBannerText: {
    color: '#fef08a',
    fontSize: 11,
    lineHeight: 16,
  },

  // Appareil actif connecté
  activeBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.5)',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 14,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
  },
  activeName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  activeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stopBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  stopBtnTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  disconnectBtn: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  disconnectBtnTxt: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },

  nativeCastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    marginBottom: 14,
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
  localName: { color: '#f8fafc', fontSize: 13, fontWeight: '700', marginTop: 2 },
  editBtn: { backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm },
  editBtnTxt: { color: '#818cf8', fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { color: '#64748b', fontSize: 12, textAlign: 'center', paddingVertical: 18, fontStyle: 'italic' },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: 10, borderRadius: Radius.md,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  deviceName: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  deviceSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 6 },
  castPill: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  remotePill: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  castText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
