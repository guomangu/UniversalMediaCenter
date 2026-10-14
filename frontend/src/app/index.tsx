import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, ScrollView, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { SiteHeader } from '@/components/SiteHeader';
import { TagSearchBar } from '@/components/TagSearchBar';
import { FloatingCategoryBar } from '@/components/FloatingCategoryBar';
import { CategorySection } from '@/components/CategorySection';
import { fetchTaxonomy, TaxonomyCategory } from '@/services/taxonomyApi';
import { Spacing, MaxContentWidth } from '@/constants/theme';

export default function HomeScreen() {
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
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 70), animated: true });
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}>
          <SiteHeader />
          <FloatingCategoryBar
            categories={categories}
            onSelectCategory={handleJumpToCategory}
          />
          <TagSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
          {loading ? (
            <ActivityIndicator color="#6366f1" style={{ marginVertical: 40 }} />
          ) : (
            categories.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                activeFilter={activeFilter}
                searchQuery={searchQuery}
                onLayoutPos={(id, y) => { catPositions.current[id] = y; }}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  safeArea: { flex: 1, alignItems: 'center' },
  scroll: { width: '100%' },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingTop: Platform.OS === 'web' ? 70 : Spacing.two,
    paddingBottom: 80,
    paddingHorizontal: Spacing.two,
  },
});
