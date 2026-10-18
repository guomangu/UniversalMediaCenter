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
import { UserDevicesTab } from '@/components/user/UserDevicesTab';
import { MediaCard } from '@/components/MediaCard';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';
import { goBackOrFallback } from '@/utils/navigation';

type UserTab = 'CONTINUE' | 'FAVORITES' | 'FRIENDS' | 'FORUMS' | 'FEED' | 'DEVICES';
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
    if (tab && ['CONTINUE', 'FAVORITES', 'FRIENDS', 'FORUMS', 'FEED', 'DEVICES'].includes(tab.toUpperCase())) {
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
                onPress={() => setActiveTab('DEVICES')}
                style={[styles.tabBtn, activeTab === 'DEVICES' && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, activeTab === 'DEVICES' && styles.tabTxtActive]}>
                  📱 Appareils & Diffusions
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
                      <View key={item.id} style={styles.continueCardWrapper}>
                        <MediaCard item={item} styleVariant="LANDSCAPE" />
                      </View>
                    ))}
                  </ScrollView>
                )}

                <Text style={[styles.subSecTitle, { marginTop: Spacing.four }]}>🕒 Historique récent</Text>
                {historyList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTxt}>Aucun historique récent.</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                    {historyList.map((item) => (
                      <View key={item.id} style={styles.continueCardWrapper}>
                        <MediaCard item={item} styleVariant="LANDSCAPE" />
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {activeTab === 'FAVORITES' && (
              <View style={styles.tabBody}>
                <View style={styles.favHeader}>
                  <Text style={styles.subSecTitle}>❤️ Mes Favoris</Text>
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

            {activeTab === 'DEVICES' && <UserDevicesTab />}

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
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    paddingBottom: Spacing.six,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  navBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  navBtnTxt: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  inner: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  tabScroll: {
    marginBottom: Spacing.two,
  },
  tabRow: {
    gap: 8,
    paddingVertical: 4,
  },
  tabBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  tabBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  tabTxt: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTxtActive: {
    color: '#ffffff',
  },
  tabBody: {
    gap: Spacing.three,
  },
  subSecTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
  },
  horizontalRow: {
    gap: 12,
    paddingVertical: 4,
  },
  continueCardWrapper: {
    width: 260,
  },
  emptyBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: Radius.lg,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyTxt: {
    color: '#94a3b8',
    fontSize: 14,
  },
  actionBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  actionBtnTxt: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  favHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  favFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  favFilterPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  favFilterPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  favFilterPillTxt: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  favFilterPillTxtActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  favoriteItemWrapper: {
    width: 140,
  },
  favActionFooter: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  favPlayBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 4,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  favPlayTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  favRemoveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  favRemoveTxt: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
});
