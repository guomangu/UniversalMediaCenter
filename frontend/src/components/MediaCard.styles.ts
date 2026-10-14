import { StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  cardContainer: {
    marginRight: Spacing.three,
  },
  imageWrapper: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(38, 44, 54, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
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
    backgroundColor: 'rgba(35, 41, 51, 0.95)',
  },
  placeholderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7c8797',
    letterSpacing: 1.5,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  ratingText: {
    color: '#cfb991',
    fontSize: 11,
    fontWeight: '600',
  },
  seasonBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  seasonBadgeText: {
    color: '#d6dbe3',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(20, 24, 30, 0.6)',
    zIndex: 15,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#b95252',
  },
  title: {
    marginTop: Spacing.one + 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#dfe4ec',
    lineHeight: 18,
    minHeight: 36,
  },
  subtext: {
    fontSize: 12,
    color: '#8a95a5',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
