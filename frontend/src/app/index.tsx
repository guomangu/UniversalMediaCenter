import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, ScrollView, RefreshControl, ActivityIndicator, useWindowDimensions, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { SiteHeader } from '@/components/SiteHeader';
import { TagSearchBar } from '@/components/TagSearchBar';
import { CategorySection } from '@/components/CategorySection';
import { fetchTaxonomy, TaxonomyCategory } from '@/services/taxonomyApi';
import { Spacing, MaxContentWidth, Radius } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tous');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const catPositions = useRef<Record<string, number>>({});

  const loadData = async () => {
    const list = await fetchTaxonomy();
    setCategories(list);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleJumpToCategory = (id: string) => {
    const y = catPositions.current[id];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - (isMobile ? 100 : 92)), animated: true });
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <SiteHeader
          categories={categories}
          onSelectCategory={handleJumpToCategory}
          onScrollToTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.contentContainer, { paddingTop: isMobile ? 98 : 90 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}>
          <TagSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
          {loading ? (
            <ActivityIndicator color="#6366f1" style={{ marginVertical: 40 }} />
          ) : categories.length > 0 ? (
            categories.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                activeFilter={activeFilter}
                searchQuery={searchQuery}
                onLayoutPos={(id, y) => { catPositions.current[id] = y; }}
              />
            ))
          ) : (
            <View style={styles.emptyWelcomeBox}>
              <Text style={styles.welcomeIcon}>🎬</Text>
              <Text style={styles.welcomeTitle}>Bienvenue sur Universal Media Stack</Text>
              <Text style={styles.welcomeDesc}>
                Votre médiathèque s'initialise. Vous pouvez dès maintenant profiter des espaces fonctionnels :
              </Text>
              <View style={styles.quickActions}>
                <Pressable onPress={() => router.push('/tv')} style={styles.quickBtn}>
                  <Text style={styles.quickBtnTxt}>📺 Regarder la TV en Direct</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/user')} style={[styles.quickBtn, { backgroundColor: '#4f46e5' }]}>
                  <Text style={styles.quickBtnTxt}>👤 Mon Espace & Profil</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/admin')} style={[styles.quickBtn, { backgroundColor: '#334155' }]}>
                  <Text style={styles.quickBtnTxt}>⚙️ Administration & Sources</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  safeArea: { flex: 1, width: '100%' },
  scroll: { width: '100%', flex: 1 },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 80,
    paddingHorizontal: Spacing.two,
  },
  emptyWelcomeBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    gap: 12,
  },
  welcomeIcon: { fontSize: 44 },
  welcomeTitle: { fontSize: 20, fontWeight: '900', color: '#f8fafc', textAlign: 'center' },
  welcomeDesc: { color: '#94a3b8', fontSize: 13, textAlign: 'center', maxWidth: 450, lineHeight: 18 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 10 },
  quickBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  quickBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
});
