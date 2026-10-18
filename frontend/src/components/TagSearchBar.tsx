import React, { useState, useEffect } from 'react';
import { View, TextInput, ScrollView, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

const FILTER_TAGS = ['Tous', '4K', '1080p', '720p', '480p', 'MOVIE', 'SHOW', 'Action', 'Animation', 'Comédie'];

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
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: any) => {
                      e?.stopPropagation?.();
                      onFilterChange(f === activeFilter ? 'Tous' : f);
                    },
                  } as any)
                : {})}
              style={[styles.filterChip, isSelected && styles.activeChip]}>
              <Text style={[styles.filterText, isSelected && styles.activeText]} pointerEvents="none">
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
    justifyContent: 'center',
  },
  input: {
    backgroundColor: 'rgba(38, 44, 54, 0.85)',
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 36,
    color: '#edeef2',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.16)',
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b4554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: '#edeef2',
    fontSize: 11,
    fontWeight: 'bold',
  },
  searchBtn: {
    backgroundColor: '#3b4554',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.16)',
  },
  searchBtnPressed: {
    opacity: 0.8,
  },
  searchBtnActive: {
    backgroundColor: '#4e5d73',
    borderColor: '#7c8fa6',
  },
  searchBtnTxt: {
    color: '#edeef2',
    fontSize: 13,
    fontWeight: '600',
  },
  filterRow: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  filterPrefix: {
    color: '#7c8797',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(38, 44, 54, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.1)',
  },
  activeChip: {
    backgroundColor: '#3b4554',
    borderColor: 'rgba(160, 175, 195, 0.4)',
  },
  filterText: {
    color: '#9ba7b7',
    fontSize: 12,
    fontWeight: '500',
  },
  activeText: {
    color: '#edeef2',
    fontWeight: '700',
  },
});
