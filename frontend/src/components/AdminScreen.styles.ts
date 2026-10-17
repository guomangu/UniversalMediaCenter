import { StyleSheet, Platform } from 'react-native';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: {
    maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center',
    paddingHorizontal: Spacing.three, paddingBottom: 80,
    paddingTop: Platform.OS === 'web' ? 70 : Spacing.four,
  },
  heading: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginBottom: Spacing.three },
  tabScroll: {
    marginBottom: Spacing.four,
    ...(Platform.OS === 'web' ? ({
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    } as any) : {}),
  },
  tabRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', paddingVertical: 2, paddingHorizontal: 2 },
  tabBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap', userSelect: 'none' } as any) : {}),
  },
  activeTab: { backgroundColor: '#6366f1' },
  tabText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.75)', borderRadius: Radius.md, padding: Spacing.four, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#94a3b8', marginBottom: Spacing.three, lineHeight: 18 },
  railRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: 'rgba(51, 65, 85, 0.3)' },
  railText: { color: '#f1f5f9', fontSize: 14 },
  statusPill: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { color: '#34d399', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.5)', borderRadius: Radius.md, padding: Spacing.two + 2, color: '#f8fafc', marginBottom: Spacing.two },
  submitBtn: { backgroundColor: '#6366f1', paddingVertical: Spacing.two + 2, borderRadius: Radius.pill, alignItems: 'center', marginTop: Spacing.one },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#ffffff', fontWeight: '700' },
  statusMsg: { marginTop: Spacing.two, color: '#a5b4fc', fontSize: 13, textAlign: 'center' },
});
