import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { searchCatalog, fetchMediaStats } from '@/services/api';
import { MediaStatsResponse } from '@/services/types';
import { MediaCard } from '@/components/MediaCard';
import { TagPill } from '@/components/TagPill';
import { ExploreStats } from '@/components/ExploreStats';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

type TypeFilter = 'ALL' | 'MOVIE' | 'SHOW' | 'COLLECTION';
type SortMode = 'RELEVANCE' | 'YEAR' | 'RATING';

const TYPE_LABELS: Record<TypeFilter, string> = {
  ALL: 'Tout',
  MOVIE: 'Films',
  SHOW: 'Séries',
  COLLECTION: 'Sagas',
};

const SORT_LABELS: Record<SortMode, string> = {
  RELEVANCE: 'Pertinence',
  YEAR: 'Année ↓',
  RATING: 'Note ↓',
};

export default function ExploreScreen() {
  const router = useRouter();
  const headerPaddingTop = useHeaderHeight(false);
  const params = useLocalSearchParams<{ q?: string; tag?: string; label?: string }>();

  const initialQuery = String(params.q || params.label || (params.tag ? params.tag.replace(/-/g, ' ') : '') || '');
  const [query, setQuery] = useState(initialQuery);
  const [nodes, setNodes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [stats, setStats] = useState<MediaStatsResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeTag, setActiveTag] = useState<{ slug: string; label?: string } | null>(
    params.tag ? { slug: String(params.tag), label: params.label ? String(params.label) : undefined } : null
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('RELEVANCE');

  // Les liens profonds (`/explore?q=...`, `/explore?tag=...`) étaient ignorés :
  // la page démarrait toujours avec une recherche vide.
  useEffect(() => {
    const nextQuery = String(params.q || params.label || (params.tag ? params.tag.replace(/-/g, ' ') : '') || '');
    if (nextQuery) setQuery(nextQuery);
    setActiveTag(params.tag ? { slug: String(params.tag), label: params.label ? String(params.label) : undefined } : null);
    setTypeFilter('ALL');
  }, [params.q, params.tag, params.label]);

  useEffect(() => {
    fetchMediaStats().then(setStats);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setNodes([]);
      setTags([]);
      setPeople([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCatalog(trimmed)
        .then((d) => {
          if (cancelled) return;
          setNodes(Array.isArray(d.nodes) ? d.nodes : []);
          setTags(Array.isArray(d.tags) ? d.tags : []);
          setPeople(Array.isArray(d.people) ? d.people : []);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const isSearchMode = query.trim().length >= 2;

  const filterByType = (items: any[]) =>
    items.filter((item) => typeFilter === 'ALL' || item.nodeType === typeFilter);

  const sortItems = (items: any[]) => {
    const copy = [...items];
    if (sortMode === 'YEAR') {
      copy.sort((a, b) => (Number(b.releaseYear) || 0) - (Number(a.releaseYear) || 0));
    } else if (sortMode === 'RATING') {
      copy.sort((a, b) => (Number(b.communityRating) || 0) - (Number(a.communityRating) || 0));
    }
    return copy;
  };

  const displayList = useMemo(() => {
    const base = isSearchMode ? nodes : (stats?.recent || []);
    return sortItems(filterByType(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchMode, nodes, stats, typeFilter, sortMode]);

  const listTitle = isSearchMode
    ? `Résultats (${displayList.length})`
    : `Derniers Ajouts (${displayList.length})`;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (activeTag) setActiveTag(null);
  };

  const handleTagPress = (tag: any) => {
    const label = tag.label || tag.value_text || tag.slug || tag.value_slug;
    setQuery(label);
    setActiveTag({ slug: tag.slug || tag.value_slug, label });
    setTypeFilter('ALL');
  };

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Exploration du Catalogue</Text>
            <Text style={styles.subheading}>
              Recherche floue, personnes, genres et filtres croisés — même hors-ligne.
            </Text>
          </View>
        </View>

        <TextInput
          style={styles.searchBar}
          data-search-input="true"
          placeholder="Rechercher par titre, genre, acteur, 4K, CSA..."
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
        />

        {activeTag && (
          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterLabel}>Filtre actif :</Text>
            <Pressable
              focusable={true}
              onPress={() => {
                setActiveTag(null);
                setQuery('');
              }}
              style={styles.activeFilterChip}
            >
              <Text style={styles.activeFilterChipTxt}>#{activeTag.label || activeTag.slug} ✕</Text>
            </Pressable>
          </View>
        )}

        {!isSearchMode && stats && (
          <ExploreStats
            stats={stats}
            onSelectGenre={(g) => {
              setActiveTag(null);
              setQuery(g);
            }}
          />
        )}

        {tags.length > 0 && (
          <View style={styles.tagSection}>
            <Text style={styles.sectionTitle}>Tags & Filtres</Text>
            <View style={styles.tagWrap}>
              {tags.map((t: any) => (
                <TagPill
                  key={`${t.slug}-${t.category || ''}`}
                  label={t.label || t.value_text}
                  subtext={t.category}
                  theme="indigo"
                  onPress={() => handleTagPress(t)}
                />
              ))}
            </View>
          </View>
        )}

        {people.length > 0 && (
          <View style={styles.peopleSection}>
            <Text style={styles.sectionTitle}>Personnes ({people.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
              {people.map((person: any) => (
                <Pressable
                  key={`${person.slug}-${person.role || ''}`}
                  focusable={true}
                  onPress={() =>
                    router.push({
                      pathname: '/person/[slug]',
                      params: { slug: person.slug, name: person.name, role: person.role || '' },
                    } as any)
                  }
                  style={({ pressed }) => [styles.personCard, pressed && styles.personCardPressed]}
                >
                  <View style={styles.personAvatar}>
                    <Text style={styles.personAvatarTxt}>{String(person.name || '?').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.personName} numberOfLines={2}>{person.name}</Text>
                  <Text style={styles.personRole} numberOfLines={1}>{person.role || 'Personne'}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.controlsRow}>
          <View style={styles.pillGroup}>
            {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((key) => (
              <Pressable
                key={key}
                focusable={true}
                onPress={() => setTypeFilter(key)}
                style={[styles.pill, typeFilter === key && styles.pillActive]}
              >
                <Text style={[styles.pillTxt, typeFilter === key && styles.pillTxtActive]}>{TYPE_LABELS[key]}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.pillGroup}>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((key) => (
              <Pressable
                key={key}
                focusable={true}
                onPress={() => setSortMode(key)}
                style={[styles.pill, sortMode === key && styles.pillActive]}
              >
                <Text style={[styles.pillTxt, sortMode === key && styles.pillTxtActive]}>{SORT_LABELS[key]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>{listTitle}</Text>
          {searching && <ActivityIndicator size="small" color="#818cf8" />}
        </View>

        {displayList.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{isSearchMode ? '🔎' : '🍿'}</Text>
            <Text style={styles.emptyTitle}>
              {isSearchMode ? 'Aucun résultat' : 'Aucun ajout récent'}
            </Text>
            <Text style={styles.emptyText}>
              {isSearchMode
                ? `Aucun média ne correspond à « ${query.trim()} »${typeFilter !== 'ALL' ? ` dans le filtre ${TYPE_LABELS[typeFilter]}` : ''}. Essayez un autre terme ou retirez un filtre.`
                : 'La médiathèque est encore vide ou en cours d’indexation.'}
            </Text>
            {(typeFilter !== 'ALL' || sortMode !== 'RELEVANCE') && (
              <Pressable
                focusable={true}
                onPress={() => {
                  setTypeFilter('ALL');
                  setSortMode('RELEVANCE');
                }}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnTxt}>Réinitialiser les filtres</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.grid}>
            {displayList.map((node: any) => (
              <View key={node.id} style={styles.gridItem}>
                <MediaCard item={node} styleVariant="POSTER" />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.three, paddingBottom: 80 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two },
  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  subheading: { fontSize: 12.5, color: '#94a3b8', marginTop: 3 },
  searchBar: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    color: '#f8fafc',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  activeFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.three, flexWrap: 'wrap' },
  activeFilterLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  activeFilterChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(129, 140, 248, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  activeFilterChipTxt: { color: '#c7d2fe', fontSize: 12, fontWeight: '700' },
  tagSection: { marginBottom: Spacing.four },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  peopleSection: { marginBottom: Spacing.four },
  peopleRow: { gap: 10, paddingVertical: 8, paddingRight: 8 },
  personCard: {
    width: 116,
    padding: 10,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  personCardPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  personAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#312e81',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  personAvatarTxt: { color: '#e0e7ff', fontWeight: '800', fontSize: 16 },
  personName: { color: '#f8fafc', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  personRole: { color: '#94a3b8', fontSize: 10.5, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: Spacing.two },
  controlsRow: { gap: 8, marginBottom: Spacing.three },
  pillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  pillActive: { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderColor: '#6366f1' },
  pillTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  pillTxtActive: { color: '#c7d2fe', fontWeight: '800' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  gridItem: { marginBottom: Spacing.two },
  emptyState: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    padding: Spacing.five,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 520 },
  resetBtn: { marginTop: 8, backgroundColor: '#4f46e5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md },
  resetBtnTxt: { color: '#ffffff', fontWeight: '700', fontSize: 12.5 },
});
