import React, { useState } from 'react';
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
  const visibleTags = category.tags.slice(0, tagLimit);
  const hasMore = category.tags.length > tagLimit;

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayoutPos?.(category.id, e.nativeEvent.layout.y);
  };

  const handleCount = (slug: string, c: number) => {
    setCounts((prev) => (prev[slug] === c ? prev : { ...prev, [slug]: c }));
  };

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
        {visibleTags.map((tag) => (
          <TagCard
            key={tag.slug}
            categoryId={category.id}
            tag={tag}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            onCountChange={handleCount}
          />
        ))}
      </View>

      {hasMore && !searchQuery ? (
        <Pressable focusable={true} onPress={() => setTagLimit((prev) => prev + 10)} style={styles.moreBtn}>
          <Text style={styles.moreText}>
            ▼ Afficher plus (+10 tags) • {visibleTags.length}/{category.tags.length}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.four },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.two },
  categoryTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  tagCountBadge: { backgroundColor: 'rgba(51, 65, 85, 0.5)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  tagCountText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  verticalTagList: { marginTop: 4 },
  moreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    marginTop: 6,
    marginBottom: Spacing.two,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  moreText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
});
