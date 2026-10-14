import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchCatalog } from '@/services/api';
import { MediaCard } from '@/components/MediaCard';
import { TagPill } from '@/components/TagPill';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [nodes, setNodes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  useEffect(() => {
    searchCatalog(query || 'a').then((data) => {
      setNodes(data.nodes || []);
      setTags(data.tags || []);
    });
  }, [query]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Exploration & Filtres par Tags</Text>
        <TextInput
          style={styles.searchBar}
          placeholder="Filtrer par genres, 4K, acteurs..."
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={setQuery}
        />
        {tags.length > 0 && (
          <View style={styles.tagSection}>
            <Text style={styles.sectionTitle}>Tags Populaires</Text>
            <View style={styles.tagWrap}>
              {tags.map((t) => (
                <TagPill
                  key={t.id}
                  label={t.value_text}
                  theme={t.color_theme || 'violet'}
                  onPress={() => setQuery(t.value_text)}
                />
              ))}
            </View>
          </View>
        )}
        <Text style={styles.sectionTitle}>Catalogue ({nodes.length})</Text>
        <View style={styles.grid}>
          {nodes.map((node) => (
            <View key={node.id} style={styles.gridItem}>
              <MediaCard item={node} styleVariant="POSTER" />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', padding: Spacing.four },
  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: Spacing.three },
  searchBar: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    color: '#f8fafc',
    marginBottom: Spacing.three,
  },
  tagSection: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: Spacing.two },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  gridItem: { marginBottom: Spacing.three },
});
