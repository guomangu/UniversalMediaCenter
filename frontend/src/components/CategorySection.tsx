import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
import { TaxonomyCategory } from '@/services/taxonomyApi';
import { TagCard } from './TagCard';
import { ClickableTopicText } from './ClickableTopicText';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  category: TaxonomyCategory;
  activeFilter?: string;
  searchQuery?: string;
  onLayoutPos?: (id: string, y: number) => void;
}

export function CategorySection({ category, activeFilter, searchQuery, onLayoutPos }: Props) {
  const [tagLimit, setTagLimit] = useState(5);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mediasByTag, setMediasByTag] = useState<Record<string, string[]>>({});
  const visibleTags = category.tags.slice(0, tagLimit);
  const hasMore = category.tags.length > tagLimit;

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

  const hasLoadedAny = Object.keys(counts).length > 0;
  const allEmpty = hasLoadedAny && Object.values(counts).every((c) => c === 0);
  if (searchQuery && allEmpty) return null;

  const matchedCount = Object.values(counts).filter((c) => c > 0).length;

  return (
    <View onLayout={handleLayout} style={styles.container}>
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
          // Déduplication intra-catégorie : exclure tous les médias déjà affichés par les tags précédents
          const excludeIds = visibleTags
            .slice(0, index)
            .flatMap((t) => mediasByTag[t.slug] || []);

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
            Afficher plus (+10 tags) • {visibleTags.length}/{category.tags.length}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.four },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.two },
  categoryTitle: { fontSize: 44, fontWeight: '700', color: '#edeef2', letterSpacing: -0.5 },
  tagCountBadge: { backgroundColor: 'rgba(148, 163, 184, 0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  tagCountText: { color: '#8b97a8', fontSize: 11, fontWeight: '600' },
  verticalTagList: { marginTop: 4 },
  moreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(50, 60, 74, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: 6,
    marginBottom: Spacing.two,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  moreText: { color: '#a0adc0', fontSize: 12, fontWeight: '600' },
});
