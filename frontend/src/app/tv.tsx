import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteHeader } from '@/components/SiteHeader';
import { TvSearchBar } from '@/components/TvSearchBar';
import { TvChannelCard } from '@/components/TvChannelCard';
import { fetchLiveChannels, fetchIptvCategories } from '@/services/api';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function TvScreen() {
  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = async (q = searchQuery, cat = activeCategory) => {
    setLoading(true);
    const [chList, catList] = await Promise.all([
      fetchLiveChannels({ q: q.trim() || undefined, category: cat !== 'ALL' ? cat : undefined }),
      categories.length === 0 ? fetchIptvCategories() : Promise.resolve(categories),
    ]);
    setChannels(chList);
    if (categories.length === 0) setCategories(catList);
    setLoading(false);
  };

  useEffect(() => { loadData(searchQuery, activeCategory); }, [searchQuery, activeCategory]);

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerHero}>
          <Text style={styles.heroTitle}>📺 Télévision en Direct (IPTV)</Text>
          <Text style={styles.heroSub}>
            Flux directs, zapping haute performance et salons de discussion communautaires en direct pour chaque chaîne.
          </Text>
        </View>

        <TvSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        <View style={styles.countRow}>
          <Text style={styles.countTxt}>
            {loading ? 'Chargement...' : `${channels.length} chaîne${channels.length > 1 ? 's' : ''} disponible${channels.length > 1 ? 's' : ''}`}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#6366f1" size="large" style={{ marginVertical: 40 }} />
        ) : channels.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aucune chaîne trouvée</Text>
            <Text style={styles.emptySub}>Essayez un autre mot-clé ou sélectionnez une autre catégorie.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {channels.map((ch) => (
              <TvChannelCard key={ch.id} channel={ch} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', padding: Spacing.three, paddingTop: 64, paddingBottom: 40 },
  headerHero: { marginBottom: Spacing.three },
  heroTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: '#94a3b8', fontSize: 13, marginTop: 4, lineHeight: 18 },
  countRow: { marginBottom: 12 },
  countTxt: { color: '#818cf8', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 6 },
  emptyTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#64748b', fontSize: 12 },
});
