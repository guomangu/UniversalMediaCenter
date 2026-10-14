import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Spacing } from '@/constants/theme';
import { UiRailItem } from '@/services/types';
import { MediaCard } from './MediaCard';

interface MediaRailProps {
  rail: UiRailItem;
}

export const MediaRail: React.FC<MediaRailProps> = ({ rail }) => {
  if (!rail.items || rail.items.length === 0) return null;

  const cardStyleVariant =
    rail.cardStyle === 'LANDSCAPE'
      ? 'LANDSCAPE'
      : rail.cardStyle === 'LIVE_CARD'
      ? 'LIVE_CARD'
      : 'POSTER';

  return (
    <View style={styles.railContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{rail.title}</Text>
        <Text style={styles.badge}>{rail.items.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {rail.items.map((item) => (
          <MediaCard key={item.id} item={item} styleVariant={cardStyleVariant} />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  railContainer: {
    marginBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818cf8',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
  },
});
