import { StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    padding: Spacing.four,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 12px 24px rgba(0, 0, 0, 0.5)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24 }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(71, 85, 105, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: Radius.pill,
    padding: 3,
    marginBottom: Spacing.three,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    alignItems: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  tabItemActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: Spacing.two,
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
});
