import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
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
  const [expanded, setExpanded] = useState(false);
  const visibleTags = expanded ? category.tags : category.tags.slice(0, 5);

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayoutPos?.(category.id, e.nativeEvent.layout.y);
  };

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
          <Text style={styles.tagCountText}>{category.tags.length} tags</Text>
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
          />
        ))}
      </View>

      {category.tags.length > 5 ? (
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.moreBtn}>
          <Text style={styles.moreText}>
            {expanded ? '▲ Réduire les tags' : `▼ Voir ${category.tags.length - 5} autres tags (${category.title})`}
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
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
    marginTop: 4,
    marginBottom: Spacing.two,
  },
  moreText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
});
