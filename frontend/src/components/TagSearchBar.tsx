import React from 'react';
import { View, TextInput, ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

const FILTER_TAGS = ['Tous', '1080p', '720p', 'MOVIE', 'SHOW', 'Action', 'Animation', 'Comédie'];

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: string;
  onFilterChange: (f: string) => void;
}

export function TagSearchBar({ searchQuery, onSearchChange, activeFilter, onFilterChange }: Props) {
  const getFilterLabel = (f: string) => {
    if (f === 'MOVIE') return 'Films';
    if (f === 'SHOW') return 'Séries';
    return f;
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="Rechercher un tag (Tarantino, 2023, Action, Bleach)..."
          placeholderTextColor="#7c8797"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery ? (
          <Pressable focusable={true} onPress={() => onSearchChange('')} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Text style={styles.filterPrefix}>Filtres :</Text>
        {FILTER_TAGS.map((f) => {
          const isSelected = activeFilter === f;
          return (
            <Pressable
              focusable={true}
              key={f}
              onPress={() => onFilterChange(f === activeFilter ? 'Tous' : f)}
              style={[styles.filterChip, isSelected && styles.activeChip]}>
              <Text style={[styles.filterText, isSelected && styles.activeText]}>
                {getFilterLabel(f)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.three },
  inputWrap: { position: 'relative', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(38, 44, 54, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.16)',
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: '#edeef2',
    fontSize: 13,
  },
  clearBtn: { position: 'absolute', right: 14, top: 9, padding: 2 },
  clearText: { color: '#8894a4', fontSize: 13, fontWeight: '700' },
  filterRow: { gap: 6, alignItems: 'center' },
  filterPrefix: { color: '#7c8797', fontSize: 11, fontWeight: '600', marginRight: 4 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(42, 48, 58, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  activeChip: { backgroundColor: 'rgba(70, 85, 105, 0.5)', borderColor: 'rgba(148, 163, 184, 0.4)' },
  filterText: { color: '#8e9ab0', fontSize: 11, fontWeight: '600' },
  activeText: { color: '#edeef2', fontWeight: '700' },
});
