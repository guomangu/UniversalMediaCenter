import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { TaxonomyCategory } from '@/services/taxonomyApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  categories: TaxonomyCategory[];
  activeCategoryId?: string;
  onSelectCategory: (id: string) => void;
}

export function FloatingCategoryBar({ categories, activeCategoryId, onSelectCategory }: Props) {
  if (categories.length === 0) return null;

  return (
    <View style={styles.floatingWrapper}>
      <View style={styles.bar}>
        <Text style={styles.prefix}>Raccourcis :</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {categories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => onSelectCategory(cat.id)}
                style={[styles.chip, isActive && styles.activeChip]}>
                <Text style={[styles.chipText, isActive && styles.activeText]}>
                  {cat.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    width: '100%',
    alignSelf: 'center',
    marginBottom: Spacing.two,
    zIndex: 50,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  prefix: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '800',
    marginRight: 6,
    textTransform: 'uppercase',
  },
  scroll: {
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  activeChip: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  activeText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
