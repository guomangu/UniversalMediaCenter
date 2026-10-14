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
          placeholder="🔍 Rechercher un tag (ex: Tarantino, 2023, Action, Bleach)..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery ? (
          <Pressable onPress={() => onSearchChange('')} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Text style={styles.filterPrefix}>Filtres rapides :</Text>
        {FILTER_TAGS.map((f) => {
          const isSelected = activeFilter === f;
          return (
            <Pressable
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
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
  },
  clearBtn: { position: 'absolute', right: 14, top: 10, padding: 2 },
  clearText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  filterRow: { gap: 6, alignItems: 'center' },
  filterPrefix: { color: '#64748b', fontSize: 11, fontWeight: '700', marginRight: 4 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  activeChip: { backgroundColor: '#4f46e5', borderColor: '#818cf8' },
  filterText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  activeText: { color: '#ffffff', fontWeight: '700' },
});
