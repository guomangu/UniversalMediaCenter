import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { RelatedTagGroup } from '@/services/types';
import { MediaTile } from './MediaTile';
import { ClickableTopicText } from './ClickableTopicText';
import { TagPill } from './TagPill';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  relatedTags?: RelatedTagGroup[];
  fallbackTags?: any[];
}

export function MediaGenreSection({ relatedTags = [], fallbackTags = [] }: Props) {
  const router = useRouter();
  const withMedias = relatedTags.filter((t) => t.medias.length > 0);
  const withoutMedias = relatedTags.filter((t) => t.medias.length === 0);

  if (relatedTags.length === 0 && fallbackTags.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.secTitle}>Genres & Thématiques</Text>

      {withMedias.map((t) => (
        <View key={t.slug + t.label} style={styles.tagCard}>
          <View style={styles.tagHeader}>
            <View style={styles.titleWrap}>
              <ClickableTopicText text={t.label} topicSlug={t.slug} topicTitle={t.label} style={styles.tagTitle} />
              <View style={styles.countPill}>
                <Text style={styles.countText}>{t.medias.length} autre{t.medias.length > 1 ? 's' : ''}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: t.slug, title: t.label } } as any)}
              style={styles.forumBtn}>
              <Text style={styles.forumTxt}>💬 Forum #{t.label}</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
            {t.medias.map((m) => <MediaTile key={m.id} item={m} />)}
          </ScrollView>
        </View>
      ))}

      {withoutMedias.length > 0 ? (
        <View style={styles.otherWrap}>
          <Text style={styles.subTitle}>Autres tags associés (aucun média supplémentaire) :</Text>
          <View style={styles.pillRow}>
            {withoutMedias.map((t) => (
              <TagPill key={t.slug + t.label} label={t.label} theme={t.colorTheme || 'slate'} />
            ))}
          </View>
        </View>
      ) : withMedias.length === 0 && fallbackTags.length > 0 ? (
        <View style={styles.pillRow}>
          {fallbackTags.map((p, i) => <TagPill key={i} label={p.value_text} theme={p.color_theme || 'violet'} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.four },
  secTitle: { fontSize: 16, fontWeight: '800', color: '#f8fafc', textTransform: 'uppercase', marginBottom: Spacing.three, letterSpacing: -0.3 },
  tagCard: { backgroundColor: 'rgba(30, 41, 59, 0.65)', borderRadius: Radius.lg, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.35)' },
  tagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagTitle: { fontSize: 15, fontWeight: '800', color: '#f8fafc' },
  countPill: { backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill },
  countText: { color: '#a5b4fc', fontSize: 10, fontWeight: '700' },
  forumBtn: { backgroundColor: 'rgba(51, 65, 85, 0.6)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  forumTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  mediaRow: { paddingVertical: 4, gap: 4, alignItems: 'center' },
  otherWrap: { marginTop: Spacing.two, padding: Spacing.two, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: Radius.md },
  subTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
