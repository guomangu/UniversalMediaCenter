import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useCurrentUser, logout } from '@/services/authStore';
import {
  fetchUserStats,
  fetchContinueWatching,
  fetchWatchHistory,
  fetchFavorites,
  fetchUserProfile,
} from '@/services/userApi';
import { UserProfileCard } from '@/components/user/UserProfileCard';
import { UserStatsCard } from '@/components/user/UserStatsCard';
import { UserFriendsTab } from '@/components/user/UserFriendsTab';
import { UserForumsTab } from '@/components/user/UserForumsTab';
import { UserFeedTab } from '@/components/user/UserFeedTab';
import { MediaCard } from '@/components/MediaCard';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

type UserTab = 'CONTINUE' | 'FAVORITES' | 'FRIENDS' | 'FORUMS' | 'FEED';

export default function UserScreen() {
  const router = useRouter();
  const authUser = useCurrentUser();
  const [profile, setProfile] = useState<any>(authUser);
  const [activeTab, setActiveTab] = useState<UserTab>('CONTINUE');
  const [stats, setStats] = useState<any>(null);
  const [continueList, setContinueList] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [favoritesList, setFavoritesList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = async () => {
    setRefreshing(true);
    const [p, s, c, h, f] = await Promise.all([
      fetchUserProfile(),
      fetchUserStats(),
      fetchContinueWatching(),
      fetchWatchHistory(),
      fetchFavorites(),
    ]);
    if (p) setProfile(p);
    if (s) setStats(s);
    setContinueList(c);
    setHistoryList(h);
    setFavoritesList(f);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} />}>
          {/* Header Bar */}
          <View style={styles.topNav}>
            <Pressable focusable={true} onPress={() => router.push('/')} style={styles.navBtn}>
              <Text style={styles.navBtnTxt}>← Accueil</Text>
            </Pressable>
            <Text style={styles.pageTitle}>👤 Mon Espace</Text>
            <Pressable focusable={true} onPress={handleLogout} style={[styles.navBtn, { backgroundColor: '#dc2626' }]}>
              <Text style={[styles.navBtnTxt, { color: '#ffffff' }]}>Déconnexion</Text>
            </Pressable>
          </View>

          <View style={styles.inner}>
            {/* Profil & Stats */}
            {profile ? (
              <UserProfileCard user={profile} onProfileUpdated={(up) => setProfile(up)} />
            ) : null}

            {stats ? (
              <UserStatsCard userStats={stats.userStats} mediaStats={stats.mediaStats} />
            ) : null}

            {/* Onglets */}
            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setActiveTab('CONTINUE')}
                style={[styles.tabBtn, activeTab === 'CONTINUE' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'CONTINUE' && styles.tabTxtActive]}>
                  🍿 Reprendre ({continueList.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('FAVORITES')}
                style={[styles.tabBtn, activeTab === 'FAVORITES' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FAVORITES' && styles.tabTxtActive]}>
                  ❤️ Favoris ({favoritesList.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('FRIENDS')}
                style={[styles.tabBtn, activeTab === 'FRIENDS' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FRIENDS' && styles.tabTxtActive]}>
                  👥 Amis
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('FORUMS')}
                style={[styles.tabBtn, activeTab === 'FORUMS' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FORUMS' && styles.tabTxtActive]}>
                  💬 Mes Salons
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('FEED')}
                style={[styles.tabBtn, activeTab === 'FEED' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FEED' && styles.tabTxtActive]}>
                  🔄 Fil d'avis
                </Text>
              </Pressable>
            </View>

            {/* Contenu de l'onglet actif */}
            {activeTab === 'CONTINUE' && (
              <View style={styles.tabBody}>
                <Text style={styles.subSecTitle}>🍿 En cours de visionnage</Text>
                {continueList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTxt}>Aucune lecture en cours. Lancez une série ou un film !</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                    {continueList.map((item) => (
                      <MediaCard key={item.id} item={item} styleVariant="POSTER" />
                    ))}
                  </ScrollView>
                )}

                <Text style={[styles.subSecTitle, { marginTop: 24 }]}>🕒 Historique de visionnage ({historyList.length})</Text>
                {historyList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTxt}>Historique vide pour le moment.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {historyList.map((h) => (
                      <Pressable
                        key={h.id}
                        onPress={() => router.push(`/player/${h.id}` as any)}
                        style={styles.historyRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyTitle}>{h.title}</Text>
                          {h.displayBadge || h.seasonEpisodeTag ? (
                            <Text style={styles.historyBadge}>{h.displayBadge || h.seasonEpisodeTag}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.historyProgress}>
                          {h.isCompleted ? '✅ Terminé' : `${h.progressPercent || 0}%`}
                        </Text>
                        <Text style={styles.replayTxt}>▶ Revoir</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {activeTab === 'FAVORITES' && (
              <View style={styles.tabBody}>
                <Text style={styles.subSecTitle}>❤️ Mes Médias Favoris ({favoritesList.length})</Text>
                {favoritesList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTxt}>Vous n'avez pas encore ajouté de favoris.</Text>
                    <Pressable onPress={() => router.push('/')} style={styles.actionBtn}>
                      <Text style={styles.actionBtnTxt}>Découvrir le catalogue</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.mediaGrid}>
                    {favoritesList.map((item) => (
                      <MediaCard key={item.id} item={item} styleVariant="POSTER" />
                    ))}
                  </View>
                )}
              </View>
            )}

            {activeTab === 'FRIENDS' && <UserFriendsTab />}

            {activeTab === 'FORUMS' && <UserForumsTab />}

            {activeTab === 'FEED' && <UserFeedTab />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingBottom: 60 },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.3)',
  },
  pageTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc' },
  navBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  navBtnTxt: { color: '#f1f5f9', fontWeight: '700', fontSize: 12 },
  inner: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', padding: Spacing.four },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tabBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  tabBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  tabTxt: { color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  tabTxtActive: { color: '#ffffff', fontWeight: '800' },
  tabBody: { gap: 12 },
  subSecTitle: { fontSize: 15, fontWeight: '800', color: '#818cf8', textTransform: 'uppercase', marginBottom: 8 },
  horizontalRow: { gap: 12, paddingVertical: 4 },
  emptyBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
    gap: 10,
  },
  emptyTxt: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  actionBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill },
  actionBtnTxt: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: Radius.md,
    padding: 12,
    gap: 12,
  },
  historyTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 13 },
  historyBadge: { color: '#818cf8', fontSize: 11, fontWeight: '800', marginTop: 2 },
  historyProgress: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  replayTxt: { color: '#6366f1', fontWeight: '800', fontSize: 12 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
