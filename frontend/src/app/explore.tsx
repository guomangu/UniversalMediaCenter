import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchCatalog, fetchMediaStats } from '@/services/api';
import { MediaStatsResponse } from '@/services/types';
import { MediaCard } from '@/components/MediaCard';
import { TagPill } from '@/components/TagPill';
import { ExploreStats } from '@/components/ExploreStats';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function ExploreScreen() {
  const headerPaddingTop = useHeaderHeight(false);
  const [query, setQuery] = useState('');
  const [nodes, setNodes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [stats, setStats] = useState<MediaStatsResponse | null>(null);

  useEffect(() => {
    fetchMediaStats().then(setStats);
  }, []);

  useEffect(() => {
    if (query.trim().length >= 2) {
      searchCatalog(query).then((d) => { setNodes(d.nodes || []); setTags(d.tags || []); });
    } else {
      setNodes([]); setTags([]);
    }
  }, [query]);

  const displayList = query.trim().length >= 2 ? nodes : (stats?.recent || []);
  const listTitle = query.trim().length >= 2
    ? `Résultats (${nodes.length})` : `Derniers Ajouts (${displayList.length})`;

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}>
        <Text style={styles.heading}>Exploration du Catalogue</Text>
        <TextInput
          style={styles.searchBar}
          placeholder="Rechercher par titre, genre, acteur..."
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={setQuery}
        />
        {query.trim().length < 2 && stats && (
          <ExploreStats stats={stats} onSelectGenre={(g) => setQuery(g)} />
        )}
        {tags.length > 0 && (
          <View style={styles.tagSection}>
            <Text style={styles.sectionTitle}>Tags & Filtres</Text>
            <View style={styles.tagWrap}>
              {tags.map((t) => (
                <TagPill key={t.id} label={t.value_text} theme={t.color_theme || 'violet'} onPress={() => setQuery(t.value_text)} />
              ))}
            </View>
          </View>
        )}
        <Text style={styles.sectionTitle}>{listTitle}</Text>
        <View style={styles.grid}>
          {displayList.map((node) => (
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
  content: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.three, paddingBottom: 80, paddingTop: Platform.OS === 'web' ? 70 : Spacing.four },
  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: Spacing.three },
  searchBar: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.5)', borderRadius: Radius.pill, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, color: '#f8fafc', marginBottom: Spacing.three },
  tagSection: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: Spacing.two },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  gridItem: { marginBottom: Spacing.two },
});
