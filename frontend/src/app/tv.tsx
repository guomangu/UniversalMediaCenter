import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { TvSearchBar } from '@/components/TvSearchBar';
import { TvChannelCard } from '@/components/TvChannelCard';
import { fetchLiveChannels } from '@/services/api';
import { Spacing, MaxContentWidth } from '@/constants/theme';

export default function TvScreen() {
  const headerPaddingTop = useHeaderHeight(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchLiveChannels({
          category: activeCategory === 'ALL' ? undefined : activeCategory,
          q: searchQuery.trim() || undefined,
        });
        if (isMounted) {
          setChannels(data);
        }
      } catch (err) {
        console.error('Erreur chargement chaînes IPTV:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const timer = setTimeout(load, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.groupTitle) set.add(c.groupTitle);
    });
    return Array.from(set);
  }, [channels]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five * 2,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerHero: {
    marginBottom: Spacing.three,
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
    paddingVertical: Spacing.five * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  emptyState: {
    width: '100%',
    paddingVertical: Spacing.five * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    fontStyle: 'italic',
  },
});
