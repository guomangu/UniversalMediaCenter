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
            <Text style={styles.logoText}>{isMobile ? 'UMS' : siteName}</Text>
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
                  <Text style={styles.userNavPillTxt}>Favoris ({favoritesCount})</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FRIENDS')}
                >
                  <Text style={styles.userNavPillTxt}>Amis</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FORUMS')}
                >
                  <Text style={styles.userNavPillTxt}>Salons</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FEED')}
                >
                  <Text style={styles.userNavPillTxt}>Fil d'avis</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable focusable={true} style={styles.tvBtn} onPress={() => router.push('/tv' as any)}>
              <Text style={styles.tvBtnText}>TV</Text>
            </Pressable>

            {currentUser ? (
              <Pressable
                focusable={true}
                style={styles.profileBtn}
                onPress={() => router.push('/user' as any)}>
                <Text style={styles.profileBtnText}>
                  {currentUser.displayName}{currentUser.isAdmin ? ' • Admin' : ''}
                </Text>
              </Pressable>
            ) : (
              <Pressable focusable={true} style={styles.loginBtn} onPress={() => router.push('/login' as any)}>
                <Text style={styles.loginBtnText}>Connexion</Text>
              </Pressable>
            )}

            {currentUser?.isAdmin ? (
              <Pressable focusable={true} style={styles.adminBtn} onPress={() => router.push('/admin' as any)}>
                <Text style={styles.adminBtnText}>Admin</Text>
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
              <Text style={styles.userNavPillTxt}>Favoris ({favoritesCount})</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FRIENDS')}
            >
              <Text style={styles.userNavPillTxt}>Amis</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FORUMS')}
            >
              <Text style={styles.userNavPillTxt}>Salons</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FEED')}
            >
              <Text style={styles.userNavPillTxt}>Fil d'avis</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {categories.length > 0 && onSelectCategory ? (
          <View style={styles.secondTierRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {onScrollToTop ? (
                <Pressable focusable={true} onPress={onScrollToTop} style={styles.homeBtn}>
                  <Text style={styles.homeTxt}>Haut</Text>
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
    backgroundColor: 'rgba(28, 33, 41, 0.94)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(160, 175, 195, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  header: { flexDirection: 'column', maxWidth: MaxContentWidth, width: '100%', gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  logoBtn: { cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  logoText: { fontSize: 15, fontWeight: '700', color: '#edeef2', letterSpacing: -0.3 },
  secondTierRow: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingTop: 5, borderTopWidth: 1, borderTopColor: 'rgba(160, 175, 195, 0.1)' },
  scroll: { gap: 6, alignItems: 'center', paddingRight: 16 },
  homeBtn: { backgroundColor: 'rgba(55, 65, 80, 0.45)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, marginRight: 2 },
  homeTxt: { color: '#c5cedb', fontSize: 11, fontWeight: '700' },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(42, 48, 58, 0.6)', borderWidth: 1, borderColor: 'rgba(160, 175, 195, 0.14)' },
  actChip: { backgroundColor: 'rgba(70, 85, 105, 0.5)', borderColor: 'rgba(148, 163, 184, 0.4)' },
  chipTxt: { color: '#8e9ab0', fontSize: 11, fontWeight: '600' },
  actTxt: { color: '#edeef2', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  userShortcutsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginRight: 4 },
  userNavPill: {
    backgroundColor: 'rgba(42, 48, 58, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  userNavPillTxt: { color: '#c5cedb', fontSize: 11, fontWeight: '600' },
  mobileUserScroll: { gap: 6, paddingVertical: 2, paddingHorizontal: 2 },
  mobileUserPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tvBtn: { backgroundColor: 'rgba(55, 68, 85, 0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(140, 165, 195, 0.25)' },
  tvBtnText: { color: '#cbd5e1', fontWeight: '700', fontSize: 11 },
  loginBtn: { backgroundColor: '#3b4554', paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.pill },
  loginBtnText: { color: '#edeef2', fontWeight: '600', fontSize: 11 },
  profileBtn: { backgroundColor: 'rgba(50, 60, 75, 0.45)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(140, 165, 195, 0.22)' },
  profileBtnText: { color: '#cbd5e1', fontWeight: '700', fontSize: 11 },
  adminBtn: { backgroundColor: 'rgba(42, 48, 58, 0.6)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill },
  adminBtnText: { color: '#c5cedb', fontWeight: '600', fontSize: 11 },
});
