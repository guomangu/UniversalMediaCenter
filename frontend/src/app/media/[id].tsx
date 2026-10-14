import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMediaDetail, resolveImageUrl } from '@/services/api';
import { MediaDetailResponse } from '@/services/types';
import { TagPill } from '@/components/TagPill';
import { ClickableTopicText } from '@/components/ClickableTopicText';
import { MediaChildrenRow } from '@/components/MediaChildrenRow';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<MediaDetailResponse | null>(null);

  useEffect(() => { if (id) fetchMediaDetail(id).then(setData); }, [id]);

  if (!data) return <View style={styles.loading}><Text style={{ color: '#94a3b8' }}>Chargement...</Text></View>;
  const { media, tags, children = [] } = data;
  const fanartUri = resolveImageUrl(media.fanartPath || media.posterPath);
  const playId = children.length > 0 ? children[0].id : media.id;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.push('/')} style={styles.backBtn}><Text style={styles.backTxt}>← Retour à l'accueil</Text></Pressable>

        <View style={styles.heroBox}>
          {fanartUri ? <Image source={{ uri: fanartUri }} style={styles.backdrop} /> : null}
          <View style={styles.heroContent}>
            <View style={styles.zoneRow}>{tags.HERO_BADGE.map((b, i) => <TagPill key={i} label={b.value_text} theme={b.color_theme || 'amber'} />)}</View>
            <ClickableTopicText text={media.title} topicSlug={media.slug || media.id} topicTitle={media.title} style={styles.title} />
            {media.overview ? <ClickableTopicText text={media.overview} topicSlug={media.slug || media.id} topicTitle={media.title} style={styles.overview} /> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => router.push(`/player/${playId}` as any)} style={styles.playBtn}><Text style={styles.btnText}>▶ Regarder</Text></Pressable>
              <Pressable onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: media.slug || media.id, title: media.title } } as any)} style={[styles.playBtn, { backgroundColor: '#334155' }]}>
                <Text style={styles.btnText}>💬 Forum WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <MediaChildrenRow parentType={media.nodeType} parentPoster={media.posterPath} children={children} />

        <View style={styles.section}>
          <Text style={styles.secTitle}>Genres & Thématiques</Text>
          <View style={styles.zoneRow}>{tags.PRIMARY_PILL.map((p, i) => <TagPill key={i} label={p.value_text} theme={p.color_theme || 'violet'} />)}</View>
        </View>

        {tags.PERSON_CAROUSEL.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Casting & Équipe</Text>
            <View style={styles.zoneRow}>{tags.PERSON_CAROUSEL.map((c, i) => <TagPill key={i} label={c.value_text} subtext={c.context_role} theme="emerald" />)}</View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  content: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.three, paddingBottom: 80, paddingTop: Spacing.three },
  backBtn: { marginBottom: 12, paddingVertical: 6, alignSelf: 'flex-start', cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  backTxt: { color: '#818cf8', fontSize: 13, fontWeight: '700' },
  heroBox: { minHeight: 280, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: Spacing.four, justifyContent: 'flex-end', marginBottom: Spacing.four, position: 'relative' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  heroContent: { zIndex: 10 },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.one },
  title: { fontSize: 26, fontWeight: '800', color: '#ffffff', marginBottom: Spacing.one },
  overview: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: Spacing.three, maxWidth: 700 },
  playBtn: { alignSelf: 'flex-start', backgroundColor: '#6366f1', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Radius.pill, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  btnText: { color: '#ffffff', fontWeight: '700' },
  section: { marginBottom: Spacing.four },
  secTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: Spacing.two },
  childTile: { width: 114, marginRight: 6, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  childImgWrap: { width: 114, height: 160, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: 'rgba(30, 41, 59, 0.85)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)', position: 'relative', marginBottom: 5 },
  childImg: { width: '100%', height: '100%' },
  childEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  childPlayBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(99, 102, 241, 0.9)', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  childPlayTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  childTitle: { color: '#f1f5f9', fontSize: 11, fontWeight: '600', lineHeight: 14, textAlign: 'center' },
});
