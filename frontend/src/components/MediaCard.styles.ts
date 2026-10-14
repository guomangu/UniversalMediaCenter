import { StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  cardContainer: {
    marginRight: Spacing.three,
  },
  imageWrapper: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#64748b',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    marginTop: Spacing.one + 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#f1f5f9',
    lineHeight: 18,
    minHeight: 36,
  },
  subtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
