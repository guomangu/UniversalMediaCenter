import React, { useState, useEffect } from 'react';
import { View, TextInput, ScrollView, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

const FILTER_TAGS = ['Tous', '1080p', '720p', 'MOVIE', 'SHOW', 'Action', 'Animation', 'Comédie'];

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: string;
  onFilterChange: (f: string) => void;
}

export function TagSearchBar({ searchQuery, onSearchChange, activeFilter, onFilterChange }: Props) {
  // Saisie locale différée pour éliminer tout rechargement / autocomplétion intempestive à chaque frappe
  const [localText, setLocalText] = useState(searchQuery);

  useEffect(() => {
    setLocalText(searchQuery);
  }, [searchQuery]);

  const handleSearch = () => {
    onSearchChange(localText.trim());
  };

  const handleClear = () => {
    setLocalText('');
    onSearchChange('');
  };

  const getFilterLabel = (f: string) => {
    if (f === 'MOVIE') return 'Films';
    if (f === 'SHOW') return 'Séries';
    return f;
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Rechercher un tag (Tarantino, 2023, Action, Bleach)..."
            placeholderTextColor="#7c8797"
            value={localText}
            onChangeText={setLocalText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            data-search-input="true"
          />
          {localText ? (
            <Pressable focusable={true} onPress={handleClear} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          focusable={true}
          onPress={handleSearch}
          style={({ pressed }) => [
            styles.searchBtn,
            pressed && styles.searchBtnPressed,
            localText.trim() !== searchQuery && localText.trim().length > 0 && styles.searchBtnActive,
          ]}
        >
          <Text style={styles.searchBtnTxt}>🔍 Rechercher</Text>
        </Pressable>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputWrap: {
    flex: 1,
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(38, 44, 54, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.16)',
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    paddingRight: 36,
    color: '#edeef2',
    fontSize: 13,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    top: 9,
    padding: 2,
  },
  clearText: {
    color: '#8894a4',
    fontSize: 13,
    fontWeight: '700',
  },
  searchBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  searchBtnPressed: {
    opacity: 0.8,
  },
  searchBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  searchBtnTxt: {
    color: '#f0f9ff',
    fontSize: 12,
    fontWeight: '700',
  },
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
