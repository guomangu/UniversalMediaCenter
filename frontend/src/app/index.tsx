import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { SearchBar } from '@/components/SearchBar';
import { HeroSpotlight } from '@/components/HeroSpotlight';
import { MediaRail } from '@/components/MediaRail';
import { fetchHomeLayout } from '@/services/api';
import { UiRailItem } from '@/services/types';
import { Spacing, MaxContentWidth } from '@/constants/theme';

export default function HomeScreen() {
  const [rails, setRails] = useState<UiRailItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const layoutRails = await fetchHomeLayout();
    setRails(layoutRails);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const heroRail = rails.find((r) => r.railType === 'HERO_SPOTLIGHT');
  const heroItem = heroRail?.items?.[0];
  const otherRails = rails.filter((r) => r.railType !== 'HERO_SPOTLIGHT');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }>
          <SearchBar />
          {heroItem && <HeroSpotlight item={heroItem} />}
          {otherRails.map((rail) => (
            <MediaRail key={rail.id} rail={rail} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: {
    width: '100%',
  },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingTop: Platform.OS === 'web' ? 70 : Spacing.two,
    paddingBottom: 80,
    paddingHorizontal: Spacing.two,
  },
});
