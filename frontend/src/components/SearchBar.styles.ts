import { StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { position: 'relative', width: '100%', zIndex: 100, marginBottom: Spacing.three },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    color: '#f8fafc',
    fontSize: 14,
  },
  dropdown: {
    position: 'absolute',
    top: 48, left: 0, right: 0,
    backgroundColor: '#1e293b',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.6)',
    maxHeight: 300,
    zIndex: 200,
    elevation: 8,
  },
  scroll: { padding: Spacing.two },
  section: { marginBottom: Spacing.two },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  resultRow: { paddingVertical: Spacing.one, borderBottomWidth: 1, borderBottomColor: 'rgba(51, 65, 85, 0.4)' },
  resultTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  resultSub: { color: '#64748b', fontSize: 11 },
  emptyResult: { color: '#94a3b8', fontSize: 12, paddingVertical: Spacing.two, textAlign: 'center' },
});
