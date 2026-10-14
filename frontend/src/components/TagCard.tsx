import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
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
}

export function TagCard({ categoryId, tag, activeFilter, searchQuery }: Props) {
  const router = useRouter();
  const [medias, setMedias] = useState<MediaTileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTaxonomyMedias({
      category: categoryId,
      tag: tag.slug,
      filter: activeFilter,
      q: searchQuery,
    }).then((items) => {
      setMedias(items);
      setLoading(false);
    });
  }, [categoryId, tag.slug, activeFilter, searchQuery]);

  if (!loading && medias.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <ClickableTopicText
            text={tag.label}
            topicSlug={tag.slug}
            topicTitle={tag.label}
            style={styles.tagTitle}
          />
          <View style={styles.countPill}>
            <Text style={styles.countText}>{tag.count} médias</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: tag.slug, title: tag.label } } as any)}
          style={styles.forumBtn}>
          <Text style={styles.forumTxt}>💬 Forum #{tag.label}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 15 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
          {medias.map((m) => (
            <MediaTile key={m.id} item={m} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagTitle: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  countPill: { backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill },
  countText: { color: '#a5b4fc', fontSize: 10, fontWeight: '700' },
  forumBtn: { backgroundColor: 'rgba(51, 65, 85, 0.6)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
  forumTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  mediaRow: { paddingVertical: 4, gap: 4 },
});
