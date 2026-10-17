import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import { fetchUserForums } from '@/services/userApi';
import { fetchActiveSessions, MediaSession } from '@/services/sessionApi';
import { resolveImageUrl } from '@/services/api';

export function UserForumsTab() {
  const router = useRouter();
  const [subTab, setSubTab] = useState<'WATCH_PARTY' | 'TOPICS'>('WATCH_PARTY');
  const [activeSessions, setActiveSessions] = useState<MediaSession[]>([]);
  const [forums, setForums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [sessRes, forumList] = await Promise.all([
      fetchActiveSessions(),
      fetchUserForums(),
    ]);
    setActiveSessions(sessRes.sessions || []);
    setForums(forumList || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Sélecteur de sous-onglets Salons */}
      <View style={styles.subTabRow}>
        <Pressable
          focusable={true}
          onPress={() => setSubTab('WATCH_PARTY')}
          style={[styles.subTabBtn, subTab === 'WATCH_PARTY' && styles.subTabBtnActive]}
        >
          <Text style={[styles.subTabTxt, subTab === 'WATCH_PARTY' && styles.subTabTxtActive]}>
            🍿 Séances en direct ({activeSessions.length})
          </Text>
        </Pressable>

        <Pressable
          focusable={true}
          onPress={() => setSubTab('TOPICS')}
          style={[styles.subTabBtn, subTab === 'TOPICS' && styles.subTabBtnActive]}
        >
          <Text style={[styles.subTabTxt, subTab === 'TOPICS' && styles.subTabTxtActive]}>
            💬 Salons de discussion ({forums.length})
          </Text>
        </Pressable>
      </View>

      {loading && activeSessions.length === 0 && forums.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#818cf8" size="small" />
          <Text style={styles.loadingTxt}>Chargement de vos salons...</Text>
        </View>
      ) : subTab === 'WATCH_PARTY' ? (
        /* 1. SECTIONS SALONS DE VISIONNAGE PARTAGÉ */
        <View style={styles.tabContent}>
          <View style={styles.headerRow}>
            <Text style={styles.secTitle}>🔴 Séances collectives en cours ({activeSessions.length})</Text>
            <Pressable focusable={true} onPress={loadData} style={styles.refreshPill}>
              <Text style={styles.refreshPillTxt}>↻ Actualiser</Text>
            </Pressable>
          </View>

          {activeSessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🍿</Text>
              <Text style={styles.emptyTitle}>Aucun salon de visionnage en cours</Text>
              <Text style={styles.emptyDesc}>
                Lancez une séance collective depuis la fiche d'un film ou d'une série pour regarder en parfaite synchronisation avec vos amis !
              </Text>
              <Pressable
                focusable={true}
                onPress={() => router.push('/')}
                style={styles.actionBtn}
              >
                <Text style={styles.actionBtnTxt}>Choisir un média sur l'accueil</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {activeSessions.map((s) => {
                const posterUri = resolveImageUrl((s as any).media?.posterPath);
                const pCount = s.participantCount || (s.participants?.length ?? 1);

                return (
                  <View key={s.id} style={styles.sessionCard}>
                    <View style={styles.sessionRow}>
                      {posterUri ? (
                        <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
                      ) : (
                        <View style={[styles.poster, styles.posterFallback]}>
                          <Text style={{ fontSize: 22 }}>🍿</Text>
                        </View>
                      )}

                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.badgeLine}>
                          <View style={styles.livePulseBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveBadgeTxt}>EN DIRECT</Text>
                          </View>
                          <Text style={styles.viewersCountTxt}>
                            👥 {pCount} spectateur{pCount > 1 ? 's' : ''}
                          </Text>
                        </View>

                        <Text style={styles.sessionTitle} numberOfLines={1}>
                          {s.title}
                        </Text>
                        <Text style={styles.hostTxt}>
                          👑 Hôte : <Text style={styles.hostName}>{s.hostDisplayName}</Text>
                        </Text>
                      </View>
                    </View>

                    <View style={styles.sessionFooter}>
                      <Pressable
                        focusable={true}
                        onPress={() =>
                          router.push({
                            pathname: '/player/[id]',
                            params: {
                              id: s.nodeId,
                              sessionId: s.id,
                              joinTime: String(Math.floor(s.currentPosition || 0)),
                              targetUser: s.hostDisplayName,
                            },
                          } as any)
                        }
                        style={styles.joinBtn}
                      >
                        <Text style={styles.joinBtnTxt}>Rejoindre le salon ▶</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        /* 2. SALONS DE DISCUSSION & FORUMS THÉMATIQUES */
        <View style={styles.tabContent}>
          <View style={styles.headerRow}>
            <Text style={styles.secTitle}>💬 Salons où vous avez participé ({forums.length})</Text>
            <Pressable
              focusable={true}
              onPress={() => router.push('/forum' as any)}
              style={styles.explorePill}
            >
              <Text style={styles.explorePillTxt}>Explorer tous les salons ↗</Text>
            </Pressable>
          </View>

          {forums.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>Aucun salon de discussion actif</Text>
              <Text style={styles.emptyDesc}>
                Participez aux échanges communautaires sur vos films, séries, sagas ou chaînes TV pour retrouver vos salons ici !
              </Text>
              <Pressable
                focusable={true}
                onPress={() => router.push('/forum' as any)}
                style={styles.actionBtn}
              >
                <Text style={styles.actionBtnTxt}>Découvrir l'Agora & les Salons</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {forums.map((f) => (
                <Pressable
                  key={f.topicSlug}
                  focusable={true}
                  onPress={() =>
                    router.push({
                      pathname: '/forum/[topic]',
                      params: {
                        topic: f.topicSlug,
                        title: f.topicTitle,
                      },
                    } as any)
                  }
                  style={styles.forumCard}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topicTitle}>{f.topicTitle}</Text>
                    <Text style={styles.topicSlug}>#{f.topicSlug}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{f.msgCount} message(s)</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  loadingBox: { padding: 30, alignItems: 'center', gap: 10 },
  loadingTxt: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
  subTabRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  subTabBtnActive: {
    backgroundColor: '#6366f1',
  },
  subTabTxt: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  subTabTxtActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  tabContent: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  secTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshPill: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  refreshPillTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  explorePill: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  explorePillTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { color: '#f1f5f9', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  emptyDesc: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 420 },
  actionBtn: {
    backgroundColor: '#6366f1',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  actionBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  sessionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    gap: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  poster: {
    width: 52,
    height: 74,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  liveBadgeTxt: { color: '#fca5a5', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  viewersCountTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '700' },
  sessionTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 15 },
  hostTxt: { color: '#94a3b8', fontSize: 12 },
  hostName: { color: '#f1f5f9', fontWeight: '700' },
  sessionFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.25)',
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  joinBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  joinBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  forumCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  topicTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  topicSlug: { color: '#818cf8', fontSize: 11, fontWeight: '600' },
  badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  badgeTxt: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
});
