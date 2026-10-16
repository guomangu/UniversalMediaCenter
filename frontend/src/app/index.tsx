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
import {
  fetchTaxonomy,
  TaxonomyCategory,
  DEFAULT_TAXONOMY_CATEGORIES,
  CACHE_KEY_CATEGORIES,
} from '@/services/taxonomyApi';
import { useCurrentUser } from '@/services/authStore';
import { useTabState } from '@/hooks/useTabState';
import { getCachedData } from '@/services/pwaDataCache';
import { Spacing, MaxContentWidth, Radius } from '@/constants/theme';

let savedHomeScrollY = 0;
let cachedCategories: TaxonomyCategory[] =
  getCachedData<TaxonomyCategory[]>(CACHE_KEY_CATEGORIES) || DEFAULT_TAXONOMY_CATEGORIES;

export default function HomeScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const [categories, setCategories] = useState<TaxonomyCategory[]>(() => {
    if (cachedCategories && cachedCategories.length > 0) return cachedCategories;
    return getCachedData<TaxonomyCategory[]>(CACHE_KEY_CATEGORIES) || DEFAULT_TAXONOMY_CATEGORIES;
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string>(() => categories[0]?.id || 'sagas');
  const activeCatRef = useRef<string>(categories[0]?.id || 'sagas');
  const [searchQuery, setSearchQuery] = useTabState('home_search_query', '');
  const [activeFilter, setActiveFilter] = useTabState('home_active_filter', 'Tous');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const catPositions = useRef<Record<string, number>>({});
  const isRestoringScroll = useRef(savedHomeScrollY > 0);
  const scrollRestoredRef = useRef(false);
  const isJumpingRef = useRef(false);

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

  const updateActiveCategory = useCallback((scrollY: number) => {
    if (!categories.length) return;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const scrollNode = (scrollRef.current as any)?.getScrollableNode?.() || (scrollRef.current as any);
      if (scrollNode && scrollNode.scrollTop + scrollNode.clientHeight >= scrollNode.scrollHeight - 40) {
        const lastCat = categories[categories.length - 1];
        if (lastCat && lastCat.id !== activeCatRef.current) {
          activeCatRef.current = lastCat.id;
          setActiveCategoryId(lastCat.id);
        }
        return;
      }

      let currentId = categories[0]?.id || '';
      for (const cat of categories) {
        const el = document.getElementById(`cat-section-${cat.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= headerPaddingTop + 50) {
            currentId = cat.id;
          }
        }
      }
      if (currentId && currentId !== activeCatRef.current) {
        activeCatRef.current = currentId;
        setActiveCategoryId(currentId);
      }
      return;
    }

    const threshold = scrollY + headerPaddingTop + 40;
    let currentId = categories[0]?.id || '';
    for (const cat of categories) {
      const pos = catPositions.current[cat.id];
      if (typeof pos === 'number' && pos <= threshold) {
        currentId = cat.id;
      }
    }
    if (currentId && currentId !== activeCatRef.current) {
      activeCatRef.current = currentId;
      setActiveCategoryId(currentId);
    }
  }, [categories, headerPaddingTop]);

  const loadData = async (force = false) => {
    const list = await fetchTaxonomy(force, (fresh) => {
      cachedCategories = fresh;
      setCategories(fresh);
    });
    if (list && list.length > 0) {
      cachedCategories = list;
      setCategories(list);
      if (!activeCatRef.current && list[0]) {
        activeCatRef.current = list[0].id;
        setActiveCategoryId(list[0].id);
      }
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
    // Chargement frais dès le premier affichage pour garantir des catégories complètes
    loadData(true);
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
    if (categories.length > 0 && savedHomeScrollY > 0 && !scrollRestoredRef.current) {
      const timer = setTimeout(() => {
        applyScroll(savedHomeScrollY);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [categories, applyScroll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const handleJumpToCategory = (catId: string) => {
    isRestoringScroll.current = false;
    isJumpingRef.current = true;
    activeCatRef.current = catId;
    setActiveCategoryId(catId);

    // Relâche le verrouillage de saut après l'achèvement de l'animation
    setTimeout(() => {
      isJumpingRef.current = false;
    }, 750);

    let targetY: number | undefined = catPositions.current[catId];

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.getElementById(`cat-section-${catId}`);
      if (el) {
        const scrollNode = (scrollRef.current as any)?.getScrollableNode?.() || (scrollRef.current as any);
        if (scrollNode) {
          const scrollRect = scrollNode.getBoundingClientRect?.() || { top: 0 };
          const elRect = el.getBoundingClientRect();
          const currentScrollTop = scrollNode.scrollTop ?? 0;
          targetY = Math.max(0, currentScrollTop + (elRect.top - scrollRect.top) - headerPaddingTop - 12);
        }
      }
    }

    if (typeof targetY === 'number' && !isNaN(targetY)) {
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      if (Platform.OS === 'web' && scrollRef.current) {
        const node = (scrollRef.current as any).getScrollableNode?.() || (scrollRef.current as any);
        if (node && node.scrollTop !== undefined) {
          if (typeof node.scroll === 'function') {
            node.scroll({ top: targetY, behavior: 'smooth' });
          } else {
            node.scrollTop = targetY;
          }
        }
      }
    }
  };

  const handleScrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    savedHomeScrollY = 0;
    if (categories.length > 0) {
      activeCatRef.current = categories[0].id;
      setActiveCategoryId(categories[0].id);
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('ums_home_scroll_y', '0');
    }
  };

  const handleContentSizeChange = () => {
    if (savedHomeScrollY > 0 && !scrollRestoredRef.current) {
      applyScroll(savedHomeScrollY);
    }
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <SiteHeader
          categories={categories}
          activeCategoryId={activeCategoryId}
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
              if (!isJumpingRef.current) {
                updateActiveCategory(y);
              }
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
                onLayoutPos={(id, y) => {
                  catPositions.current[id] = y;
                  if (savedHomeScrollY > 0) {
                    updateActiveCategory(savedHomeScrollY);
                  }
                }}
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
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.four,
  },
  emptyWelcomeBox: {
    backgroundColor: '#262c36',
    borderRadius: Radius.lg,
    padding: 24,
    marginVertical: 40,
    alignItems: 'center',
  },
  welcomeTitle: {
    color: '#edeef2',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  welcomeDesc: {
    color: '#8e9ab0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    backgroundColor: '#1b74e4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  quickBtnTxt: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
