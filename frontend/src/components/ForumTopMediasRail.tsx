import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchTaxonomyMedias, MediaTileItem } from '@/services/taxonomyApi';
import { resolveImageUrl } from '@/services/api';
import { useActiveSessionsMap } from '@/services/sessionStore';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  topic: string;
  topicTitle: string;
  category?: string;
  onProposeSession?: (media: MediaTileItem) => void;
}

export function ForumTopMediasRail({
  topic,
  topicTitle,
  category = 'genres',
  onProposeSession,
}: Props) {
  const router = useRouter();
  const sessionsMap = useActiveSessionsMap();
  const [medias, setMedias] = useState<MediaTileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTaxonomyMedias({
      category: category || 'genres',
      tag: topic,
      limit: 10,
    })
      .then((res) => {
        // Déduplication stricte sans doublons au sein de la page
        const seen = new Set<string>();
        const unique = res.items.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        }).slice(0, 10);
        setMedias(unique);
        setLoading(false);
      })
      .catch(() => {
        setMedias([]);
        setLoading(false);
      });
  }, [topic, category]);

  if (!loading && medias.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.secIcon}>🎬</Text>
          <Text style={styles.secTitle}>Médias associés à #{topicTitle}</Text>
          <View style={styles.countPill}>
            <Text style={styles.countTxt}>{medias.length} sélectionné{medias.length > 1 ? 's' : ''}</Text>
          </View>
        </View>
        <Text style={styles.hintTxt}>Cliquez pour voir ou proposez une séance</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
        >
          {medias.map((item) => {
            const activeSession = sessionsMap[item.id];
            const poster = resolveImageUrl(item.posterPath);
            const hasActiveSession = Boolean(activeSession && activeSession.count > 0);

            return (
              <View key={item.id} style={styles.mediaCard}>
                <Pressable
                  focusable={true}
                  onPress={() => router.push(`/media/${item.id}` as any)}
                  style={({ pressed }) => [styles.posterWrap, pressed && styles.pressed]}
                >
                  {poster ? (
                    <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
                  ) : (
                    <View style={styles.posterPlaceholder}>
                      <Text style={{ fontSize: 28 }}>📺</Text>
                    </View>
                  )}

                  {hasActiveSession ? (
                    <View style={styles.sessionBadge}>
                      <Text style={styles.sessionBadgeTxt}>🍿 SÉANCE</Text>
                    </View>
                  ) : null}

                  {hasActiveSession ? (
                    <View style={styles.sessionBottomInfo}>
                      <Text style={styles.sessionBottomTxt}>
                        🍿 {activeSession.count} en séance
                      </Text>
                    </View>
                  ) : null}
                </Pressable>

                <Text style={styles.mediaTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                <View style={styles.actionBtnsRow}>
                  {onProposeSession ? (
                    <Pressable
                      focusable={true}
                      onPress={() => onProposeSession(item)}
                      style={styles.sessionBtn}
                    >
                      <Text style={styles.sessionBtnTxt}>🍿 Proposer une séance</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.two,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secIcon: { fontSize: 18 },
  secTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  countPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  countTxt: { color: '#c7d2fe', fontSize: 10, fontWeight: '700' },
  hintTxt: { color: '#94a3b8', fontSize: 11 },
  scrollList: { gap: 12, paddingVertical: 4 },
  mediaCard: { width: 140 },
  posterWrap: {
    width: 140,
    height: 200,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  sessionBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  sessionBadgeTxt: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  sessionBottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  sessionBottomTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  mediaTitle: { color: '#f1f5f9', fontSize: 12, fontWeight: '700', marginTop: 6 },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sessionBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 6,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  sessionBtnTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
});
