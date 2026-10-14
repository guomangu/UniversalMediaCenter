import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPublicConfig } from '@/services/adminApi';
import { useCurrentUser } from '@/services/authStore';
import { fetchFavorites } from '@/services/userApi';
import { AccountModal } from './AccountModal';
import { TaxonomyCategory } from '@/services/taxonomyApi';
import { Radius, MaxContentWidth } from '@/constants/theme';

interface Props {
  categories?: TaxonomyCategory[];
  activeCategoryId?: string;
  onSelectCategory?: (id: string) => void;
  onScrollToTop?: () => void;
}

export function SiteHeader({ categories = [], activeCategoryId, onSelectCategory, onScrollToTop }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const [siteName, setSiteName] = useState('Universal Media Stack');
  const [modalVisible, setModalVisible] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const currentUser = useCurrentUser();

  const loadFavs = () => {
    if (currentUser) {
      fetchFavorites()
        .then((favs) => setFavoritesCount(favs.length))
        .catch(() => {});
    } else {
      setFavoritesCount(0);
    }
  };

  useEffect(() => {
    fetchPublicConfig().then((cfg) => {
      if (cfg?.siteName) setSiteName(cfg.siteName);
    });
  }, []);

  useEffect(() => {
    loadFavs();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handler = () => loadFavs();
      window.addEventListener('favoritesUpdated', handler);
      return () => window.removeEventListener('favoritesUpdated', handler);
    }
  }, [currentUser]);

  const navigateUserTab = (tab: 'FAVORITES' | 'FRIENDS' | 'FORUMS' | 'FEED') => {
    if (!currentUser) {
      router.push({
        pathname: '/login',
        params: { returnUrl: `/user?tab=${tab}` },
      } as any);
      return;
    }
    router.push({
      pathname: '/user',
      params: { tab },
    } as any);
  };

  return (
    <View style={styles.fixedWrap}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable focusable={true} onPress={onScrollToTop || (() => router.push('/'))} style={styles.logoBtn}>
            <Text style={styles.logoText}>🎬 {isMobile ? 'UMS' : siteName}</Text>
          </Pressable>

          <View style={styles.actions}>
            {/* Raccourcis Utilisateurs sur Desktop */}
            {!isMobile && currentUser ? (
              <View style={styles.userShortcutsRow}>
                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FAVORITES')}
                >
                  <Text style={styles.userNavPillTxt}>❤️ Favoris ({favoritesCount})</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FRIENDS')}
                >
                  <Text style={styles.userNavPillTxt}>👥 Amis</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FORUMS')}
                >
                  <Text style={styles.userNavPillTxt}>💬 Mes Salons</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FEED')}
                >
                  <Text style={styles.userNavPillTxt}>🔄 Fil d'avis</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable focusable={true} style={styles.tvBtn} onPress={() => router.push('/tv' as any)}>
              <Text style={styles.tvBtnText}>📺 TV</Text>
            </Pressable>

            {currentUser ? (
              <Pressable
                focusable={true}
                style={styles.profileBtn}
                onPress={() => router.push('/user' as any)}>
                <Text style={styles.profileBtnText}>
                  👤 {currentUser.displayName}{currentUser.isAdmin ? ' 👑' : ''}
                </Text>
              </Pressable>
            ) : (
              <Pressable focusable={true} style={styles.loginBtn} onPress={() => router.push('/login' as any)}>
                <Text style={styles.loginBtnText}>🔑 Se connecter</Text>
              </Pressable>
            )}

            {currentUser?.isAdmin ? (
              <Pressable focusable={true} style={styles.adminBtn} onPress={() => router.push('/admin' as any)}>
                <Text style={styles.adminBtnText}>⚙️ Admin</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Barre de navigation rapide utilisateur sur Mobile */}
        {isMobile && currentUser ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileUserScroll}>
            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FAVORITES')}
            >
              <Text style={styles.userNavPillTxt}>❤️ Favoris ({favoritesCount})</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FRIENDS')}
            >
              <Text style={styles.userNavPillTxt}>👥 Amis</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FORUMS')}
            >
              <Text style={styles.userNavPillTxt}>💬 Mes Salons</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FEED')}
            >
              <Text style={styles.userNavPillTxt}>🔄 Fil d'avis</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {categories.length > 0 && onSelectCategory ? (
          <View style={styles.secondTierRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {onScrollToTop ? (
                <Pressable focusable={true} onPress={onScrollToTop} style={styles.homeBtn}>
                  <Text style={styles.homeTxt}>🏠 Haut</Text>
                </Pressable>
              ) : null}
              {categories.map((cat) => (
                <Pressable focusable={true} key={cat.id} onPress={() => onSelectCategory(cat.id)} style={[styles.chip, activeCategoryId === cat.id && styles.actChip]}>
                  <Text style={[styles.chipTxt, activeCategoryId === cat.id && styles.actTxt]}>{cat.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
      <AccountModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fixedWrap: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0, left: 0, right: 0, zIndex: 1000,
    backgroundColor: 'rgba(15, 23, 42, 0.96)', borderBottomWidth: 1, borderBottomColor: 'rgba(99, 102, 241, 0.35)',
    paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
  },
  header: { flexDirection: 'column', maxWidth: MaxContentWidth, width: '100%', gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  logoBtn: { cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  logoText: { fontSize: 16, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 },
  secondTierRow: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(99, 102, 241, 0.15)' },
  scroll: { gap: 6, alignItems: 'center', paddingRight: 16 },
  homeBtn: { backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, marginRight: 2 },
  homeTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '800' },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(51, 65, 85, 0.55)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.35)' },
  actChip: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  chipTxt: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  actTxt: { color: '#ffffff', fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  userShortcutsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginRight: 4 },
  userNavPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  userNavPillTxt: { color: '#e2e8f0', fontSize: 11, fontWeight: '700' },
  mobileUserScroll: { gap: 6, paddingVertical: 2, paddingHorizontal: 2 },
  mobileUserPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tvBtn: { backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: '#6366f1' },
  tvBtnText: { color: '#c7d2fe', fontWeight: '800', fontSize: 11 },
  loginBtn: { backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  loginBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },
  profileBtn: { backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.45)' },
  profileBtnText: { color: '#c7d2fe', fontWeight: '800', fontSize: 11 },
  adminBtn: { backgroundColor: 'rgba(51, 65, 85, 0.6)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill },
  adminBtnText: { color: '#e2e8f0', fontWeight: '600', fontSize: 11 },
});
