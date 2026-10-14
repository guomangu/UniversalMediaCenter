import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { TaxonomyCategory, MediaTileItem, fetchTaxonomyMedias } from '@/services/taxonomyApi';
import { MediaTile } from './MediaTile';
import { ClickableTopicText } from './ClickableTopicText';
import { Radius, Spacing } from '@/constants/theme';

export function CategoryTagSection({ category, activeFilter, searchQuery }: {
  category: TaxonomyCategory; activeFilter?: string; searchQuery?: string;
}) {
  const router = useRouter();
  const [tag, setTag] = useState<string>(category.tags[0]?.slug || '');
  const [medias, setMedias] = useState<MediaTileItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!tag && category.tags.length > 0) setTag(category.tags[0].slug); }, [category.tags]);

  useEffect(() => {
    if (!tag) return;
    setLoading(true);
    fetchTaxonomyMedias({ category: category.id, tag, filter: activeFilter, q: searchQuery })
      .then((items) => { setMedias(items); setLoading(false); });
  }, [category.id, tag, activeFilter, searchQuery]);

  const activeTag = category.tags.find((t) => t.slug === tag);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ClickableTopicText text={category.title} topicSlug={category.id} topicTitle={category.title} style={styles.title} />
        {activeTag ? (
          <Pressable onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: activeTag.slug, title: activeTag.label } } as any)} style={styles.forumBtn}>
            <Text style={styles.forumTxt}>💬 Forum #{activeTag.label}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {category.tags.map((t) => {
          const isAct = tag === t.slug;
          return (
            <Pressable key={t.slug} onPress={() => setTag(t.slug)} style={[styles.pill, isAct && styles.actPill]}>
              <Text style={[styles.pillTxt, isAct && styles.actTxt]}>{t.label} <Text style={{ fontSize: 10, opacity: 0.7 }}>({t.count})</Text></Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
      ) : medias.length > 0 ? (
        <View style={styles.grid}>{medias.map((m) => <MediaTile key={m.id} item={m} />)}</View>
      ) : (
        <Text style={styles.empty}>Aucun média trouvé pour ce tag.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.four },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  forumBtn: { backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.4)' },
  forumTxt: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
  scroll: { gap: 6, paddingVertical: 4, marginBottom: 12 },
  pill: { backgroundColor: 'rgba(30, 41, 59, 0.75)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)' },
  actPill: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  pillTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  actTxt: { color: '#ffffff', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { color: '#64748b', fontSize: 12, fontStyle: 'italic', marginVertical: 8 },
});
