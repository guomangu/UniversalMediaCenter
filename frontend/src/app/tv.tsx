import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { TvSearchBar } from '@/components/TvSearchBar';
import { TvChannelCard } from '@/components/TvChannelCard';
import { fetchLiveChannels, fetchIptvCategories } from '@/services/api';
import { useTabState } from '@/hooks/useTabState';
import { getCachedData } from '@/services/pwaDataCache';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function TvScreen() {
  const headerPaddingTop = useHeaderHeight(false);
  const [searchQuery, setSearchQuery] = useTabState('tv_search_query', '');
  const [activeCategory, setActiveCategory] = useTabState('tv_active_category', 'ALL');

  const initialCachedChannels = getCachedData<any[]>(`iptv_channels_${searchQuery}_${activeCategory}_0`) || [];
  const initialCachedCategories = getCachedData<string[]>('iptv_categories') || [];

  const [channels, setChannels] = useState<any[]>(initialCachedChannels);
  const [categories, setCategories] = useState<string[]>(initialCachedCategories);
  const [loading, setLoading] = useState(initialCachedChannels.length === 0);

  const loadData = async (q = searchQuery, cat = activeCategory) => {
    if (channels.length === 0) setLoading(true);
    const [chList, catList] = await Promise.all([
      fetchLiveChannels(
        { q: q.trim() || undefined, category: cat !== 'ALL' ? cat : undefined },
        { onFreshData: (fresh) => setChannels(fresh) }
      ),
      fetchIptvCategories({ onFreshData: (fresh) => setCategories(fresh) }),
    ]);
    setChannels(chList);
    if (catList && catList.length > 0) setCategories(catList);
    setLoading(false);
  };

  useEffect(() => {
    loadData(searchQuery, activeCategory);
  }, [searchQuery, activeCategory]);

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerHero}>
          <Text style={styles.heroTitle}>📺 Télévision en Direct (IPTV)</Text>
          <Text style={styles.heroSub}>
            Flux directs, zapping haute performance et salons de discussion communautaires en direct pour chaque chaîne.
          </Text>
        </View>

        <TvSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          categories={categories}
        />

        {loading ? (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color="#E5A00D" />
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {channels.map((channel) => (
              <TvChannelCard key={channel.id} channel={channel} />
            ))}
            {channels.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune chaîne trouvée correspondant à vos critères.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1014',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl * 2,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerHero: {
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  loaderCenter: {
    paddingVertical: Spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  emptyState: {
    width: '100%',
    paddingVertical: Spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    fontStyle: 'italic',
  },
});
