import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { TaxonomyTag, MediaTileItem, fetchTaxonomyMedias } from '@/services/taxonomyApi';
import { MediaTile } from './MediaTile';
import { ClickableTopicText } from './ClickableTopicText';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  categoryId: string;
  tag: TaxonomyTag;
  activeFilter?: string;
  searchQuery?: string;
  excludeIds?: string[];
  onCountChange?: (slug: string, count: number) => void;
  onMediasLoaded?: (slug: string, ids: string[]) => void;
}

export function TagCard({
  categoryId,
  tag,
  activeFilter,
  searchQuery,
  excludeIds = [],
  onCountChange,
  onMediasLoaded,
}: Props) {
  const router = useRouter();
  const [medias, setMedias] = useState<MediaTileItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(15);

  const excludeKey = useMemo(() => excludeIds.slice().sort().join(','), [excludeIds]);

  useEffect(() => {
    setLoading(true);
    fetchTaxonomyMedias({
      category: categoryId,
      tag: tag.slug,
      filter: activeFilter,
      q: searchQuery,
      limit,
      excludeIds,
    })
      .then((res) => {
        // Déduplication de sécurité côté client
        const excludeSet = new Set(excludeIds);
        const uniqueItems = res.items.filter((m) => !excludeSet.has(m.id));
        setMedias(uniqueItems);
        setHasMore(res.hasMore);
        setLoading(false);
        onCountChange?.(tag.slug, uniqueItems.length);
        onMediasLoaded?.(tag.slug, uniqueItems.map((m) => m.id));
      })
      .catch(() => {
        setLoading(false);
        onCountChange?.(tag.slug, 0);
      });
  }, [categoryId, tag.slug, activeFilter, searchQuery, limit, excludeKey]);

  if (medias.length === 0) {
    if (!loading) return null;
    if (searchQuery) return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <ClickableTopicText text={tag.label} topicSlug={tag.slug} topicTitle={tag.label} style={styles.tagTitle} />
          <View style={styles.countPill}>
            <Text style={styles.countText}>{medias.length}{hasMore ? '+' : ''} médias</Text>
          </View>
        </View>
        <Pressable
          focusable={true}
          onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: tag.slug, title: tag.label } } as any)}
          style={styles.forumBtn}
        >
          <Text style={styles.forumTxt}>💬 Forum #{tag.label}</Text>
        </Pressable>
      </View>

      {loading && medias.length === 0 ? (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 15 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
          {medias.map((m) => <MediaTile key={m.id} item={m} />)}
          {hasMore ? (
            <Pressable focusable={true} onPress={() => setLimit((prev) => prev + 10)} style={styles.moreTile}>
              <Text style={styles.morePlus}>+10</Text>
              <Text style={styles.moreTxt}>Afficher plus</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: Radius.lg, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.35)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagTitle: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  countPill: { backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill },
  countText: { color: '#a5b4fc', fontSize: 10, fontWeight: '700' },
  forumBtn: { backgroundColor: 'rgba(51, 65, 85, 0.6)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  forumTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  mediaRow: { paddingVertical: 4, gap: 4, alignItems: 'center' },
  moreTile: { width: 112, height: 160, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.5)', backgroundColor: 'rgba(99, 102, 241, 0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 12, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  morePlus: { fontSize: 24, fontWeight: '800', color: '#818cf8' },
  moreTxt: { fontSize: 11, fontWeight: '700', color: '#c7d2fe', marginTop: 4, textAlign: 'center' },
});
