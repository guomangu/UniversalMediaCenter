import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  getCategoriesCacheKey,
} from '@/services/taxonomyApi';
import { useCurrentUser } from '@/services/authStore';
import { useTabState } from '@/hooks/useTabState';
import { getCachedData } from '@/services/pwaDataCache';
import { Spacing, MaxContentWidth, Radius } from '@/constants/theme';

let savedHomeScrollY = 0;

export default function HomeScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const [categories, setCategories] = useState<TaxonomyCategory[]>(() => {
    const key = getCategoriesCacheKey();
    const cached = getCachedData<TaxonomyCategory[]>(key);
    if (cached && cached.length > 0) return cached;
    return DEFAULT_TAXONOMY_CATEGORIES;
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
  const [hiddenCatIds, setHiddenCatIds] = useState<Record<string, boolean>>({});

  const headerPaddingTop = useHeaderHeight(true);

  // Synchronisation des catégories masquées (celles n'affichant aucun média)
  const handleVisibilityChange = useCallback((id: string, isVisible: boolean) => {
    setHiddenCatIds((prev) => {
      const currentlyHidden = prev[id] === true;
      const shouldBeHidden = !isVisible;
      if (currentlyHidden === shouldBeHidden) return prev;
      return { ...prev, [id]: shouldBeHidden };
    });
  }, []);

  // Réinitialisation des statuts masqués lors d'un changement de filtre ou de recherche
  useEffect(() => {
    setHiddenCatIds({});
  }, [searchQuery, activeFilter]);

  // Liste réactive des catégories strictement visibles (ayant au moins un média affiché)
  const visibleCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (!cat.tags || cat.tags.length === 0) return false;
      if (!searchQuery && (!activeFilter || activeFilter === 'Tous')) {
        return cat.tags.some((t) => Number(t.count) > 0);
      }
      if (hiddenCatIds[cat.id]) return false;
      return true;
    });
  }, [categories, hiddenCatIds, searchQuery, activeFilter]);

  // Ajustement de la catégorie active si l'actuelle devient masquée
  useEffect(() => {
    if (visibleCategories.length > 0 && !visibleCategories.some((c) => c.id === activeCategoryId)) {
      const fallbackId = visibleCategories[0].id;
      activeCatRef.current = fallbackId;
      setActiveCategoryId(fallbackId);
    }
  }, [visibleCategories, activeCategoryId]);

  const applyScroll = useCallback((y: number) => {
    const targetY = Math.max(0, y);
    scrollRef.current?.scrollTo({ y: targetY, animated: false });
    if (Platform.OS === 'web' && scrollRef.current) {
      const node = (scrollRef.current as any).getScrollableNode?.() || (scrollRef.current as any);
      if (node && node.scrollTop !== undefined) {
        node.scrollTop = targetY;
      }
    }
  }, []);

  const updateActiveCategory = useCallback((scrollY: number) => {
    if (!visibleCategories.length) return;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const scrollNode = (scrollRef.current as any)?.getScrollableNode?.() || (scrollRef.current as any);
      if (scrollNode && scrollNode.scrollTop + scrollNode.clientHeight >= scrollNode.scrollHeight - 40) {
        const lastCat = visibleCategories[visibleCategories.length - 1];
        if (lastCat && lastCat.id !== activeCatRef.current) {
          activeCatRef.current = lastCat.id;
          setActiveCategoryId(lastCat.id);
        }
        return;
      }

      let currentId = visibleCategories[0]?.id || '';
      for (const cat of visibleCategories) {
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
    let currentId = visibleCategories[0]?.id || '';
    for (const cat of visibleCategories) {
      const pos = catPositions.current[cat.id];
      if (typeof pos === 'number' && pos <= threshold) {
        currentId = cat.id;
      }
    }
    if (currentId && currentId !== activeCatRef.current) {
      activeCatRef.current = currentId;
      setActiveCategoryId(currentId);
    }
  }, [visibleCategories, headerPaddingTop]);

  const loadData = async (force = false) => {
    const list = await fetchTaxonomy(force, (fresh) => {
      setCategories(fresh);
      setLoading(false);
    });
    if (list && list.length > 0) {
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
    // Rechargement optimisé via cache mémoire / persistant (0 ms si frais, revalidation en tâche de fond)
    loadData(false);
  }, [currentUser?.id, currentUser?.isAdmin]);

  // Détection des interactions utilisateur réelles pour relâcher le mode restauration
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const releaseRestore = () => {
      isRestoringScroll.current = false;
      scrollRestoredRef.current = true;
    };

    window.addEventListener('wheel', releaseRestore, { passive: true });
    window.addEventListener('touchstart', releaseRestore, { passive: true });
    window.addEventListener('keydown', releaseRestore, { passive: true });

    return () => {
      window.removeEventListener('wheel', releaseRestore);
      window.removeEventListener('touchstart', releaseRestore);
      window.removeEventListener('keydown', releaseRestore);
    };
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (isRestoringScroll.current && savedHomeScrollY > 0 && !scrollRestoredRef.current) {
      applyScroll(savedHomeScrollY);
      updateActiveCategory(savedHomeScrollY);
    }
  }, [applyScroll, updateActiveCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, []);

  const handleJumpToCategory = (id: string) => {
    isRestoringScroll.current = false;
    scrollRestoredRef.current = true;
    isJumpingRef.current = true;
    activeCatRef.current = id;
    setActiveCategoryId(id);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const scrollNode = (scrollRef.current as any)?.getScrollableNode?.() || (scrollRef.current as any);
      const el = document.getElementById(`cat-section-${id}`);
      if (scrollNode && el) {
        const elRect = el.getBoundingClientRect();
        const scrollRect = scrollNode.getBoundingClientRect();
        const currentScroll = scrollNode.scrollTop;
        const target = currentScroll + (elRect.top - scrollRect.top) - headerPaddingTop - 8;
        const finalY = Math.max(0, target);
        if (typeof scrollNode.scrollTo === 'function') {
          scrollNode.scrollTo({ top: finalY, behavior: 'smooth' });
        } else {
          scrollNode.scrollTop = finalY;
        }
        savedHomeScrollY = finalY;
        if (window.sessionStorage) {
          sessionStorage.setItem('ums_home_scroll_y', String(finalY));
        }
        setTimeout(() => {
          isJumpingRef.current = false;
        }, 800);
        return;
      }
    }

    const pos = catPositions.current[id];
    if (typeof pos === 'number') {
      const target = Math.max(0, pos - headerPaddingTop - 12);
      applyScroll(target);
      savedHomeScrollY = target;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('ums_home_scroll_y', String(target));
      }
    }
    setTimeout(() => {
      isJumpingRef.current = false;
    }, 800);
  };

  const handleScrollToTop = () => {
    isRestoringScroll.current = false;
    scrollRestoredRef.current = true;
    savedHomeScrollY = 0;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const scrollNode = (scrollRef.current as any)?.getScrollableNode?.() || (scrollRef.current as any);
      if (scrollNode) {
        if (typeof scrollNode.scrollTo === 'function') {
          scrollNode.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          scrollNode.scrollTop = 0;
        }
      }
      if (window.sessionStorage) {
        sessionStorage.setItem('ums_home_scroll_y', '0');
      }
    }
    applyScroll(0);
    const firstId = visibleCategories[0]?.id || 'sagas';
    activeCatRef.current = firstId;
    setActiveCategoryId(firstId);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <SiteHeader
          activeCategoryId={activeCategoryId}
          categories={visibleCategories}
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
          {loading && categories.length === 0 ? (
            <ActivityIndicator color="#8e9ab0" style={{ marginVertical: 40 }} />
          ) : categories.length > 0 ? (
            categories.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                activeFilter={activeFilter}
                searchQuery={searchQuery}
                onVisibilityChange={handleVisibilityChange}
                onLayoutPos={(id, y) => {
                  catPositions.current[id] = y;
                  if (savedHomeScrollY > 0) {
                    updateActiveCategory(savedHomeScrollY);
                  }
                }}
              />
            ))
          ) : null}

          {!loading && categories.length > 0 && visibleCategories.length === 0 ? (
            <View style={styles.emptyWelcomeBox}>
              <Text style={styles.welcomeTitle}>Aucun média trouvé</Text>
              <Text style={styles.welcomeDesc}>
                Aucune catégorie ne contient de média correspondant à vos critères actuels.
              </Text>
            </View>
          ) : !loading && categories.length === 0 ? (
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
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d2127' },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  contentContainer: { paddingBottom: Spacing.five },
  emptyWelcomeBox: {
    marginHorizontal: 16,
    marginVertical: 40,
    padding: 24,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f0f3f8',
    marginBottom: 8,
  },
  welcomeDesc: {
    fontSize: 14,
    color: '#8e9ab0',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: '#6366f1',
  },
  quickBtnTxt: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
