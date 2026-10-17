import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useCurrentUser, logout } from '@/services/authStore';
import { useTabState } from '@/hooks/useTabState';
import {
  fetchUserStats,
  fetchContinueWatching,
  fetchWatchHistory,
  fetchFavorites,
  fetchUserProfile,
  toggleFavorite,
} from '@/services/userApi';
import { UserProfileCard } from '@/components/user/UserProfileCard';
import { UserStatsCard } from '@/components/user/UserStatsCard';
import { UserFriendsTab } from '@/components/user/UserFriendsTab';
import { UserForumsTab } from '@/components/user/UserForumsTab';
import { UserFeedTab } from '@/components/user/UserFeedTab';
import { MediaCard } from '@/components/MediaCard';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { Platform } from 'react-native';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';
import { goBackOrFallback } from '@/utils/navigation';

type UserTab = 'CONTINUE' | 'FAVORITES' | 'FRIENDS' | 'FORUMS' | 'FEED';
type FavFilter = 'ALL' | 'MOVIE' | 'SHOW' | 'EPISODE';

export default function UserScreen() {
  const router = useRouter();
  const headerPaddingTop = useHeaderHeight(false);
  const authUser = useCurrentUser();
  const [profile, setProfile] = useState<any>(authUser);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useTabState<UserTab>('user_active_tab', 'CONTINUE');
  const [favFilter, setFavFilter] = useState<FavFilter>('ALL');

  useEffect(() => {
    if (tab && ['CONTINUE', 'FAVORITES', 'FRIENDS', 'FORUMS', 'FEED'].includes(tab.toUpperCase())) {
      setActiveTab(tab.toUpperCase() as UserTab);
    }
  }, [tab]);

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
      fetchFavorites(true),
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

  const handleRemoveFavorite = async (nodeId: string) => {
    setFavoritesList((prev) => prev.filter((item) => item.id !== nodeId));
    await toggleFavorite(nodeId, false);
  };

  const filteredFavorites = favoritesList.filter((item) => {
    if (favFilter === 'ALL') return true;
    if (favFilter === 'MOVIE') return item.nodeType === 'MOVIE';
    if (favFilter === 'SHOW') return item.nodeType === 'SHOW' || item.nodeType === 'COLLECTION';
    if (favFilter === 'EPISODE') return item.nodeType === 'EPISODE';
    return true;
  });

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <SiteHeader />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} />}>
          {/* Header Bar */}
          <View style={styles.topNav}>
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => goBackOrFallback(router, '/')}
              style={styles.navBtn}>
              <Text style={styles.navBtnTxt}>← Retour</Text>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={styles.tabScroll}>
              <Pressable
                focusable={true}
                onPress={() => setActiveTab('CONTINUE')}
                style={[styles.tabBtn, activeTab === 'CONTINUE' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'CONTINUE' && styles.tabTxtActive]}>
                  🍿 Reprendre ({continueList.length})
                </Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => setActiveTab('FAVORITES')}
                style={[styles.tabBtn, activeTab === 'FAVORITES' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FAVORITES' && styles.tabTxtActive]}>
                  ❤️ Favoris ({favoritesList.length})
                </Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => setActiveTab('FRIENDS')}
                style={[styles.tabBtn, activeTab === 'FRIENDS' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FRIENDS' && styles.tabTxtActive]}>
                  👥 Amis
                </Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => setActiveTab('FORUMS')}
                style={[styles.tabBtn, activeTab === 'FORUMS' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FORUMS' && styles.tabTxtActive]}>
                  💬 Salons
                </Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => setActiveTab('FEED')}
                style={[styles.tabBtn, activeTab === 'FEED' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'FEED' && styles.tabTxtActive]}>
                  🔄 Fil d'avis
                </Text>
              </Pressable>
            </ScrollView>

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
                        focusable={true}
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
                <View style={styles.favHeaderRow}>
                  <Text style={styles.subSecTitle}>❤️ Mes Médias Favoris ({favoritesList.length})</Text>

                  {/* Filtres par type de média */}
                  <View style={styles.favFilterRow}>
                    <Pressable
                      focusable={true}
                      onPress={() => setFavFilter('ALL')}
                      style={[styles.favFilterPill, favFilter === 'ALL' && styles.favFilterPillActive]}
                    >
                      <Text style={[styles.favFilterPillTxt, favFilter === 'ALL' && styles.favFilterPillTxtActive]}>
                        Tous
                      </Text>
                    </Pressable>
                    <Pressable
                      focusable={true}
                      onPress={() => setFavFilter('MOVIE')}
                      style={[styles.favFilterPill, favFilter === 'MOVIE' && styles.favFilterPillActive]}
                    >
                      <Text style={[styles.favFilterPillTxt, favFilter === 'MOVIE' && styles.favFilterPillTxtActive]}>
                        Films
                      </Text>
                    </Pressable>
                    <Pressable
                      focusable={true}
                      onPress={() => setFavFilter('SHOW')}
                      style={[styles.favFilterPill, favFilter === 'SHOW' && styles.favFilterPillActive]}
                    >
                      <Text style={[styles.favFilterPillTxt, favFilter === 'SHOW' && styles.favFilterPillTxtActive]}>
                        Séries
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {favoritesList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTxt}>Vous n'avez pas encore ajouté de favoris.</Text>
                    <Pressable focusable={true} onPress={() => router.push('/')} style={styles.actionBtn}>
                      <Text style={styles.actionBtnTxt}>Découvrir le catalogue</Text>
                    </Pressable>
                  </View>
                ) : filteredFavorites.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTxt}>Aucun favori ne correspond à ce filtre.</Text>
                  </View>
                ) : (
                  <View style={styles.mediaGrid}>
                    {filteredFavorites.map((item) => (
                      <View key={item.id} style={styles.favoriteItemWrapper}>
                        <MediaCard item={item} styleVariant="POSTER" />
                        <View style={styles.favActionFooter}>
                          <Pressable
                            focusable={true}
                            onPress={() => router.push(`/player/${item.id}` as any)}
                            style={styles.favPlayBtn}
                          >
                            <Text style={styles.favPlayTxt}>▶ Regarder</Text>
                          </Pressable>
                          <Pressable
                            focusable={true}
                            onPress={() => handleRemoveFavorite(item.id)}
                            style={styles.favRemoveBtn}
                          >
                            <Text style={styles.favRemoveTxt}>✕ Retirer</Text>
                          </Pressable>
                        </View>
                      </View>
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
  tabScroll: {
    marginBottom: 20,
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as any)
      : {}),
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  tabBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap', userSelect: 'none' } as any) : {}),
  },
  tabBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  tabTxt: { color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  tabTxtActive: { color: '#ffffff', fontWeight: '800' },
  tabBody: { gap: 14 },
  subSecTitle: { fontSize: 14, fontWeight: '800', color: '#818cf8', textTransform: 'uppercase', letterSpacing: 0.5 },
  favHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  favFilterRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  favFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  favFilterPillActive: {
    backgroundColor: '#6366f1',
  },
  favFilterPillTxt: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  favFilterPillTxtActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  horizontalRow: { gap: 12, paddingVertical: 8 },
  emptyBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyTxt: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  actionBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  actionBtnTxt: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    padding: 12,
    borderRadius: Radius.md,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  historyTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  historyBadge: { color: '#818cf8', fontSize: 11, fontWeight: '700', marginTop: 2 },
  historyProgress: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  replayTxt: { color: '#6366f1', fontWeight: '800', fontSize: 13 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  favoriteItemWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  favActionFooter: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    justifyContent: 'center',
  },
  favPlayBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  favPlayTxt: { color: '#c7d2fe', fontSize: 10, fontWeight: '800' },
  favRemoveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  favRemoveTxt: { color: '#f87171', fontSize: 10, fontWeight: '700' },
});
