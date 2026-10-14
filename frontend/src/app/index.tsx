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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8e9ab0" />}>
          <TagSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
          {loading ? (
            <ActivityIndicator color="#8e9ab0" style={{ marginVertical: 40 }} />
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
              <Text style={styles.welcomeTitle}>Universal Media Stack</Text>
              <Text style={styles.welcomeDesc}>
                Votre médiathèque s'initialise. Vous pouvez dès maintenant explorer vos espaces :
              </Text>
              <View style={styles.quickActions}>
                <Pressable onPress={() => router.push('/tv')} style={styles.quickBtn}>
                  <Text style={styles.quickBtnTxt}>TV en Direct</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/user')} style={[styles.quickBtn, { backgroundColor: '#3b4554' }]}>
                  <Text style={styles.quickBtnTxt}>Mon Espace</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/admin')} style={[styles.quickBtn, { backgroundColor: '#2d3542' }]}>
                  <Text style={styles.quickBtnTxt}>Administration</Text>
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
  container: { flex: 1, backgroundColor: '#1d2127' },
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
    backgroundColor: 'rgba(38, 44, 54, 0.7)',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.15)',
    gap: 12,
  },
  welcomeTitle: { fontSize: 18, fontWeight: '700', color: '#edeef2', textAlign: 'center', letterSpacing: -0.3 },
  welcomeDesc: { color: '#9ba7b7', fontSize: 13, textAlign: 'center', maxWidth: 450, lineHeight: 18 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 10 },
  quickBtn: {
    backgroundColor: '#475569',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  quickBtnTxt: { color: '#edeef2', fontWeight: '700', fontSize: 12 },
});
