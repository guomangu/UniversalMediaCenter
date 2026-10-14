import React from 'react';
import { View, TextInput, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categories: string[];
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
}

export function TvSearchBar({ searchQuery, onSearchChange, categories, activeCategory, onSelectCategory }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="🔍 Rechercher une chaîne TV, une catégorie, un sport..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery ? (
          <Pressable focusable={true} onPress={() => onSearchChange('')} style={styles.clearBtn}>
            <Text style={styles.clearTxt}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
        <Pressable
          focusable={true}
          onPress={() => onSelectCategory('ALL')}
          style={[styles.pill, activeCategory === 'ALL' && styles.pillActive]}
        >
          <Text style={[styles.pillTxt, activeCategory === 'ALL' && styles.pillTxtActive]}>📺 Toutes les chaînes</Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            focusable={true}
            key={c}
            onPress={() => onSelectCategory(c)}
            style={[styles.pill, activeCategory === c && styles.pillActive]}
          >
            <Text style={[styles.pillTxt, activeCategory === c && styles.pillTxtActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.three, gap: 10 },
  inputWrap: { position: 'relative', width: '100%' },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    borderRadius: Radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  clearBtn: { position: 'absolute', right: 14, top: 12, padding: 4 },
  clearTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '800' },
  catScroll: { gap: 6, alignItems: 'center' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  pillActive: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  pillTxt: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  pillTxtActive: { color: '#ffffff', fontWeight: '800' },
});
