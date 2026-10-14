import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMediaDetail } from '@/services/api';
import { MediaDetailResponse } from '@/services/types';
import { TagPill } from '@/components/TagPill';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<MediaDetailResponse | null>(null);

  useEffect(() => {
    if (id) fetchMediaDetail(id).then(setData);
  }, [id]);

  if (!data) return <View style={styles.loading}><Text style={styles.loadingText}>Chargement...</Text></View>;
  const { media, tags } = data;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroBox}>
          {media.fanartPath ? <Image source={{ uri: media.fanartPath }} style={styles.backdrop} /> : null}
          <View style={styles.heroContent}>
            <View style={styles.zoneRow}>
              {tags.HERO_BADGE.map((b, i) => (
                <TagPill key={i} label={b.value_text} theme={b.color_theme || 'amber'} />
              ))}
            </View>
            <Text style={styles.title}>{media.title}</Text>
            {media.overview ? <Text style={styles.overview}>{media.overview}</Text> : null}
            <Pressable style={styles.playBtn} onPress={() => router.push(`/player/${media.id}` as any)}>
              <Text style={styles.playText}>▶ Regarder le Média</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Genres & Thématiques</Text>
          <View style={styles.zoneRow}>
            {tags.PRIMARY_PILL.map((p, i) => (
              <TagPill key={i} label={p.value_text} theme={p.color_theme || 'violet'} />
            ))}
          </View>
        </View>

        {tags.PERSON_CAROUSEL.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Casting & Équipe</Text>
            <View style={styles.zoneRow}>
              {tags.PERSON_CAROUSEL.map((c, i) => (
                <TagPill key={i} label={c.value_text} subtext={c.context_role} theme="emerald" />
              ))}
            </View>
          </View>
        )}

        {tags.TECHNICAL_DRAWER.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations Techniques & Métadonnées XML</Text>
            <View style={styles.zoneRow}>
              {tags.TECHNICAL_DRAWER.map((t, i) => (
                <TagPill key={i} label={`${t.display_name}: ${t.value_text}`} theme="slate" />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  loadingText: { color: '#94a3b8' },
  content: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', padding: Spacing.four },
  heroBox: { minHeight: 280, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: Spacing.four, justifyContent: 'flex-end', marginBottom: Spacing.four, position: 'relative' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  heroContent: { zIndex: 10 },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.one },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: Spacing.one },
  overview: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: Spacing.three, maxWidth: 700 },
  playBtn: { alignSelf: 'flex-start', backgroundColor: '#6366f1', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Radius.pill },
  playText: { color: '#ffffff', fontWeight: '700' },
  section: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: Spacing.two },
});
