import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { RelatedTagGroup } from '@/services/types';
import { MediaTile } from './MediaTile';
import { ClickableTopicText } from './ClickableTopicText';
import { TagPill } from './TagPill';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  currentMediaId?: string;
  relatedTags?: RelatedTagGroup[];
  fallbackTags?: any[];
}

export function MediaGenreSection({ currentMediaId, relatedTags = [], fallbackTags = [] }: Props) {
  const router = useRouter();

  // Déduplication intra-page stricte (identique à l'accueil par catégorie de tag) :
  // Ne pas réafficher un média s'il est déjà apparu dans un tag précédent sur la page
  const processedTags = useMemo(() => {
    const seenMediaIds = new Set<string>();
    if (currentMediaId) seenMediaIds.add(currentMediaId);

    return relatedTags.map((group) => {
      const uniqueMedias = (group.medias || []).filter((m) => {
        if (!m || !m.id) return false;
        if (seenMediaIds.has(m.id)) return false;
        seenMediaIds.add(m.id);
        return true;
      });

      return {
        ...group,
        medias: uniqueMedias,
      };
    });
  }, [relatedTags, currentMediaId]);

  const withMedias = processedTags.filter((t) => t.medias.length > 0);
  const withoutMedias = processedTags.filter((t) => t.medias.length === 0);

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
              focusable={true}
              onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: t.slug, title: t.label } } as any)}
              style={styles.forumBtn}>
              <Text style={styles.forumTxt}>Forum • {t.label}</Text>
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
          {fallbackTags.map((p, i) => <TagPill key={i} label={p.value_text} theme={p.color_theme || 'slate'} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.four },
  secTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#edeef2',
    letterSpacing: -0.3,
    marginBottom: Spacing.three,
  },
  tagCard: {
    backgroundColor: 'rgba(38, 44, 54, 0.65)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
  },
  tagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagTitle: { fontSize: 15, fontWeight: '700', color: '#edeef2' },
  countPill: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  countText: { color: '#94a1b3', fontSize: 10, fontWeight: '600' },
  forumBtn: {
    backgroundColor: 'rgba(45, 52, 64, 0.55)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  forumTxt: { color: '#a0adc0', fontSize: 11, fontWeight: '600' },
  mediaRow: { paddingVertical: 4, gap: 4, alignItems: 'center' },
  otherWrap: {
    marginTop: Spacing.two,
    padding: Spacing.two,
    backgroundColor: 'rgba(32, 37, 46, 0.6)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.08)',
  },
  subTitle: { fontSize: 12, fontWeight: '600', color: '#8b97a8', marginBottom: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
