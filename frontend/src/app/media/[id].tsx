import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMediaDetail, resolveImageUrl } from '@/services/api';
import { MediaDetailResponse } from '@/services/types';
import { TagPill } from '@/components/TagPill';
import { ClickableTopicText } from '@/components/ClickableTopicText';
import { MediaChildrenRow } from '@/components/MediaChildrenRow';
import { MediaGenreSection } from '@/components/MediaGenreSection';
import { CastModal } from '@/components/CastModal';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function MediaDetailScreen() {
  const { id, share } = useLocalSearchParams<{ id: string; share?: string }>();
  const router = useRouter();
  const [data, setData] = useState<MediaDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCast, setShowCast] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchMediaDetail(id, share)
        .then((res) => {
          if (!res) {
            router.replace({
              pathname: '/login',
              params: {
                returnUrl: `/media/${id}${share ? `?share=${share}` : ''}`,
                error: 'Connexion requise pour accéder à cette œuvre ou lien expiré',
              },
            } as any);
          } else {
            setData(res);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, share]);

  if (loading || !data) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: '#94a3b8' }}>Chargement du média...</Text>
      </View>
    );
  }

  const { media, tags = { HERO_BADGE: [], PRIMARY_PILL: [], PERSON_CAROUSEL: [], TECHNICAL_DRAWER: [] }, children = [], relatedTags = [] } = data;
  const fanartUri = resolveImageUrl(media.fanartPath || media.posterPath);
  const playId = children.length > 0 ? children[0].id : media.id;

  const handlePlay = () => {
    router.push({
      pathname: `/player/${playId}`,
      params: share ? { share } : undefined,
    } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.push('/')} style={styles.backBtn}><Text style={styles.backTxt}>← Retour à l'accueil</Text></Pressable>
        <View style={styles.heroBox}>
          {fanartUri ? <Image source={{ uri: fanartUri }} style={styles.backdrop} /> : null}
          <View style={styles.heroContent}>
            <View style={styles.zoneRow}>{tags.HERO_BADGE?.map((b, i) => <TagPill key={i} label={b.value_text} theme={b.color_theme || 'amber'} />)}</View>
            <ClickableTopicText text={media.title} topicSlug={media.slug || media.id} topicTitle={media.title} style={styles.title} />
            {media.overview ? <ClickableTopicText text={media.overview} topicSlug={media.slug || media.id} topicTitle={media.title} style={styles.overview} /> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pressable onPress={handlePlay} style={styles.playBtn}><Text style={styles.btnText}>▶ Regarder</Text></Pressable>
              <Pressable onPress={() => setShowCast(true)} style={[styles.playBtn, { backgroundColor: '#4338ca' }]}><Text style={styles.btnText}>📡 Diffuser</Text></Pressable>
              <Pressable onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: media.slug || media.id, title: media.title } } as any)} style={[styles.playBtn, { backgroundColor: '#334155' }]}>
                <Text style={styles.btnText}>💬 Forum WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <MediaChildrenRow parentType={media.nodeType} parentPoster={media.posterPath} children={children} />
        <MediaGenreSection relatedTags={relatedTags} fallbackTags={tags.PRIMARY_PILL} />
        {tags.PERSON_CAROUSEL?.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Casting & Équipe</Text>
            <View style={styles.zoneRow}>{tags.PERSON_CAROUSEL.map((c, i) => <TagPill key={i} label={c.value_text} subtext={c.context_role} theme="emerald" />)}</View>
          </View>
        ) : null}
      </ScrollView>
      <CastModal visible={showCast} onClose={() => setShowCast(false)} currentMedia={{ id: String(playId), title: media.title, positionSeconds: 0 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingBottom: 60 },
  loading: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  backBtn: { padding: Spacing.three },
  backTxt: { color: '#818cf8', fontWeight: '700' },
  heroBox: { position: 'relative', minHeight: 340, justifyContent: 'flex-end', padding: Spacing.four },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  heroContent: { maxWidth: MaxContentWidth, gap: 10 },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 28, fontWeight: '900', color: '#f8fafc' },
  overview: { fontSize: 14, color: '#cbd5e1', lineHeight: 22, maxWidth: 800 },
  playBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: '#6366f1' },
  btnText: { color: '#ffffff', fontWeight: '800' },
  section: { padding: Spacing.four },
  secTitle: { fontSize: 18, fontWeight: '800', color: '#f8fafc', marginBottom: 12 },
});
