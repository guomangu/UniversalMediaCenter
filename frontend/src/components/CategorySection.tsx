import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
import { TaxonomyCategory, getCachedTaxonomyMedias } from '@/services/taxonomyApi';
import { TagCard } from './TagCard';
import { ClickableTopicText } from './ClickableTopicText';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderHeight } from './SiteHeader';

interface Props {
  category: TaxonomyCategory;
  activeFilter?: string;
  searchQuery?: string;
  onLayoutPos?: (id: string, y: number) => void;
  onVisibilityChange?: (id: string, isVisible: boolean) => void;
}

export function CategorySection({
  category,
  activeFilter,
  searchQuery,
  onLayoutPos,
  onVisibilityChange,
}: Props) {
  const [tagLimit, setTagLimit] = useState(5);

  const getInitialCounts = useCallback((f?: string, q?: string) => {
    const init: Record<string, number> = {};
    for (const t of category.tags.slice(0, 5)) {
      const c = getCachedTaxonomyMedias({
        category: category.id,
        tag: t.slug,
        filter: f,
        q,
        limit: 10,
      });
      if (c?.items !== undefined) {
        init[t.slug] = c.items.length;
      }
    }
    return init;
  }, [category.id, category.tags]);

  const [counts, setCounts] = useState<Record<string, number>>(() => getInitialCounts(activeFilter, searchQuery));

  // Ajustement synchrone immédiat lors d'un changement de filtre ou de recherche
  const [prevFilter, setPrevFilter] = useState(activeFilter);
  const [prevSearch, setPrevSearch] = useState(searchQuery);

  if (prevFilter !== activeFilter || prevSearch !== searchQuery) {
    setPrevFilter(activeFilter);
    setPrevSearch(searchQuery);
    setCounts(getInitialCounts(activeFilter, searchQuery));
  }

  // Filtrage des tags : en affichage standard (sans recherche ni filtre), seuls les tags avec médias sont inclus
  const activeTags = category.tags.filter(
    (t) => (searchQuery && searchQuery.length > 0) || (activeFilter && activeFilter !== 'Tous') || Number(t.count) > 0
  );
  const visibleTags = activeTags.slice(0, tagLimit);
  const hasMore = activeTags.length > tagLimit;
  const headerPaddingTop = useHeaderHeight(true);

  // Hydratation synchrone immédiate (0 ms) des IDs en cache pour éliminer tout effet de cascade
  const [mediasByTag, setMediasByTag] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const t of category.tags.slice(0, 5)) {
      const c = getCachedTaxonomyMedias({
        category: category.id,
        tag: t.slug,
        filter: activeFilter,
        q: searchQuery,
        limit: 10,
      });
      if (c?.items?.length) {
        init[t.slug] = c.items.map((m) => m.id);
      }
    }
    return init;
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayoutPos?.(category.id, e.nativeEvent.layout.y);
  };

  const handleCount = (slug: string, c: number) => {
    setCounts((prev) => (prev[slug] === c ? prev : { ...prev, [slug]: c }));
  };

  const handleMediasLoaded = useCallback((slug: string, ids: string[]) => {
    setMediasByTag((prev) => {
      const current = prev[slug] || [];
      if (current.length === ids.length && current.every((v, i) => v === ids[i])) return prev;
      return { ...prev, [slug]: ids };
    });
  }, []);

  const hasAnyCount = category.tags.some((t) => Number(t.count) > 0);
  const allVisibleLoaded = visibleTags.length > 0 && visibleTags.every((t) => counts[t.slug] !== undefined);
  const totalCount = Object.values(counts).reduce((s, c) => s + c, 0);

  // Une catégorie n'est visible que si elle contient des tags et qu'au moins un média est présent
  const hasConfirmedMedia = totalCount > 0 || Object.values(mediasByTag).some((arr) => arr.length > 0);
  const isVisible =
    category.tags.length > 0 &&
    activeTags.length > 0 &&
    hasConfirmedMedia;

  // Notification réactive au parent (HomeScreen) pour mise à jour synchronisée des raccourcis SiteHeader
  useEffect(() => {
    onVisibilityChange?.(category.id, isVisible);
  }, [category.id, isVisible, onVisibilityChange]);

  if (!isVisible) {
    return null;
  }

  const matchedCount = Object.values(counts).filter((c) => c > 0).length;

  return (
    <View
      nativeID={`cat-section-${category.id}`}
      {...(Platform.OS === 'web' ? { id: `cat-section-${category.id}` } : {})}
      onLayout={handleLayout}
      style={[
        styles.container,
        Platform.OS === 'web' ? ({ scrollMarginTop: headerPaddingTop + 16 } as any) : null,
      ]}>
      <View style={styles.titleRow}>
        <ClickableTopicText
          text={category.title}
          topicSlug={category.id}
          topicTitle={category.title}
          style={styles.categoryTitle}
        />
        <View style={styles.tagCountBadge}>
          <Text style={styles.tagCountText}>
            {searchQuery ? `${matchedCount} actif${matchedCount > 1 ? 's' : ''}` : `${visibleTags.length}/${category.tags.length} tags`}
          </Text>
        </View>
      </View>

      <View style={styles.verticalTagList}>
        {visibleTags.map((tag, index) => {
          // Déduplication intra-catégorie pour sagas/studios, mais indépendance totale pour les rails de qualité
          const excludeIds = category.id === 'qualities'
            ? []
            : visibleTags.slice(0, index).flatMap((t) => mediasByTag[t.slug] || []);

          return (
            <TagCard
              key={tag.slug}
              categoryId={category.id}
              tag={tag}
              activeFilter={activeFilter}
              searchQuery={searchQuery}
              excludeIds={excludeIds}
              onCountChange={handleCount}
              onMediasLoaded={handleMediasLoaded}
            />
          );
        })}
      </View>

      {hasMore && !searchQuery ? (
        <Pressable focusable={true} onPress={() => setTagLimit((prev) => prev + 10)} style={styles.moreBtn}>
          <Text style={styles.moreText}>
            Afficher plus (+10 tags) • {visibleTags.length}/{activeTags.length}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.four + 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
    marginTop: Spacing.two,
    paddingHorizontal: 2,
  },
  categoryTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: '#edeef2',
    letterSpacing: -1.2,
    lineHeight: 52,
  },
  tagCountBadge: {
    backgroundColor: 'rgba(55, 65, 80, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'center',
  },
  tagCountText: { color: '#8e9ab0', fontSize: 12, fontWeight: '600' },
  verticalTagList: { gap: Spacing.three },
  moreBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(42, 48, 58, 0.6)',
    borderRadius: Radius.pill,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
  },
  moreText: { color: '#9ba7b7', fontSize: 13, fontWeight: '600' },
});
