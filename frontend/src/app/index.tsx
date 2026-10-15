import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { TagSearchBar } from '@/components/TagSearchBar';
import { CategorySection } from '@/components/CategorySection';
import { fetchTaxonomy, TaxonomyCategory } from '@/services/taxonomyApi';
import { useCurrentUser } from '@/services/authStore';
import { Spacing, MaxContentWidth, Radius } from '@/constants/theme';

let savedHomeScrollY = 0;
let cachedCategories: TaxonomyCategory[] = [];

export default function HomeScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const [categories, setCategories] = useState<TaxonomyCategory[]>(cachedCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tous');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(cachedCategories.length === 0);
  const scrollRef = useRef<ScrollView>(null);
  const catPositions = useRef<Record<string, number>>({});
  const isRestoringScroll = useRef(savedHomeScrollY > 0);
  const scrollRestoredRef = useRef(false);

  const headerPaddingTop = useHeaderHeight(true);

  const applyScroll = useCallback((y: number) => {
    if (y <= 0) return;
    scrollRef.current?.scrollTo({ y, animated: false });
    if (Platform.OS === 'web' && scrollRef.current) {
      const node = (scrollRef.current as any).getScrollableNode?.() || (scrollRef.current as any);
      if (node && node.scrollTop !== undefined) {
        node.scrollTop = y;
      }
    }
  }, []);

  const loadData = async () => {
    const list = await fetchTaxonomy();
    if (list && list.length > 0) {
      cachedCategories = list;
      setCategories(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem('ums_home_scroll_y');
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val > 0) savedHomeScrollY = val;
      }
    }
    if (savedHomeScrollY > 0) {
      isRestoringScroll.current = true;
    }
    loadData();
  }, []);

  // Détection des interactions utilisateur réelles pour relâcher le mode restauration
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleUserInteraction = () => {
        isRestoringScroll.current = false;
      };
      window.addEventListener('wheel', handleUserInteraction, { passive: true });
      window.addEventListener('touchstart', handleUserInteraction, { passive: true });
      return () => {
        window.removeEventListener('wheel', handleUserInteraction);
        window.removeEventListener('touchstart', handleUserInteraction);
      };
    }
  }, []);

  // Restauration fidèle de la zone de défilement dès que les données sont affichées
  useEffect(() => {
    if (savedHomeScrollY > 0 && !scrollRestoredRef.current) {
      isRestoringScroll.current = true;
      const t1 = setTimeout(() => applyScroll(savedHomeScrollY), 16);
      const t2 = setTimeout(() => applyScroll(savedHomeScrollY), 80);
      const t3 = setTimeout(() => applyScroll(savedHomeScrollY), 200);
      const t4 = setTimeout(() => applyScroll(savedHomeScrollY), 450);
      const t5 = setTimeout(() => {
        applyScroll(savedHomeScrollY);
        isRestoringScroll.current = false;
        scrollRestoredRef.current = true;
      }, 850);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
      };
    }
  }, [loading, applyScroll]);

  const handleContentSizeChange = (contentWidth: number, contentHeight: number) => {
    if (isRestoringScroll.current && savedHomeScrollY > 0) {
      applyScroll(savedHomeScrollY);
      if (contentHeight > savedHomeScrollY + 200) {
        scrollRestoredRef.current = true;
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleJumpToCategory = (id: string) => {
    const y = catPositions.current[id];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - headerPaddingTop), animated: true });
    }
  };

  const handleScrollToTop = () => {
    savedHomeScrollY = 0;
    isRestoringScroll.current = false;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('ums_home_scroll_y');
    }
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <SiteHeader
          categories={categories}
          onSelectCategory={handleJumpToCategory}
          onScrollToTop={handleScrollToTop}
        />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.contentContainer, { paddingTop: headerPaddingTop }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleContentSizeChange}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            if (isRestoringScroll.current) {
              if (Math.abs(y - savedHomeScrollY) < 50) {
                scrollRestoredRef.current = true;
              }
              return;
            }
            if (y >= 0) {
              savedHomeScrollY = y;
              if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
                sessionStorage.setItem('ums_home_scroll_y', String(y));
              }
            }
          }}
          scrollEventThrottle={32}
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
