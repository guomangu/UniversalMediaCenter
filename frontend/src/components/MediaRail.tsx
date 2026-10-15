import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Spacing, Radius } from '@/constants/theme';
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

  // 10 initial, puis +10 (total 20), puis +12
  const [visibleCount, setVisibleCount] = useState(10);
  const hasMore = visibleCount < rail.items.length;
  const nextIncrement = visibleCount <= 10 ? 10 : 12;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => {
      if (prev <= 10) return prev + 10;
      return prev + 12;
    });
  }, []);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 200) {
      if (hasMore) {
        handleLoadMore();
      }
    }
  }, [hasMore, handleLoadMore]);

  const visibleItems = rail.items.slice(0, visibleCount);

  return (
    <View style={styles.railContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{rail.title}</Text>
        <Text style={styles.badge}>{rail.items.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={64}
      >
        {visibleItems.map((item) => (
          <MediaCard key={item.id} item={item} styleVariant={cardStyleVariant} />
        ))}
        {hasMore ? (
          <Pressable focusable={true} onPress={handleLoadMore} style={styles.moreTile}>
            <Text style={styles.morePlus}>+{nextIncrement}</Text>
            <Text style={styles.moreTxt}>Afficher plus</Text>
          </Pressable>
        ) : null}
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
    gap: 12,
  },
  moreTile: {
    width: 110,
    height: 190,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.2)',
    backgroundColor: 'rgba(45, 52, 64, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  morePlus: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  moreTxt: {
    color: '#8e9ab0',
    fontSize: 11,
    fontWeight: '600',
  },
});
