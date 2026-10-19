import React, { useState, useEffect, useRef } from 'react';
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

export function useHeaderHeight(hasCategories: boolean = false): number {
  const { width } = useWindowDimensions();
  const currentUser = useCurrentUser();
  const isMobile = width < 860;

  if (isMobile) {
    if (hasCategories) {
      return currentUser ? 142 : 102;
    }
    return currentUser ? 104 : 68;
  }
  return hasCategories ? 96 : 68;
}

export function SiteHeader({ categories = [], activeCategoryId, onSelectCategory, onScrollToTop }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const [siteName, setSiteName] = useState('Universal Media Stack');
  const [modalVisible, setModalVisible] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const currentUser = useCurrentUser();
  const categoryScrollRef = useRef<ScrollView>(null);
  const lastActionTimeRef = useRef<number>(0);
  const lastSelectedCategoryRef = useRef<{ id: string; timestamp: number }>({ id: '', timestamp: 0 });
  const lastLogoPressRef = useRef<number>(0);

  const handleDebouncedAction = (fn: () => void) => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < 250) return;
    lastActionTimeRef.current = now;
    fn();
  };

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

  // Animation de défilement horizontal isolé du raccourci actif pour rester centré dans la barre
  useEffect(() => {
    if (!activeCategoryId) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const chipEl = document.getElementById(`cat-chip-${activeCategoryId}`);
      const scrollEl = (categoryScrollRef.current as any)?.getScrollableNode?.() || (categoryScrollRef.current as any);
      if (chipEl && scrollEl) {
        const chipRect = chipEl.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        const targetScrollLeft = chipEl.offsetLeft - (scrollRect.width / 2) + (chipRect.width / 2);
        if (typeof Element.prototype.scrollTo === 'function') {
          (Element.prototype.scrollTo as any).call(scrollEl, { left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
        } else {
          scrollEl.scrollLeft = Math.max(0, targetScrollLeft);
        }
      }
    }
  }, [activeCategoryId]);

  const navigateUserTab = (tab: 'FAVORITES' | 'FRIENDS' | 'FORUMS' | 'FEED') => {
    handleDebouncedAction(() => {
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
    });
  };

  const handleLogoPress = () => {
    const now = Date.now();
    if (now - lastLogoPressRef.current < 100) return;
    lastLogoPressRef.current = now;
    if (onScrollToTop) {
      onScrollToTop();
    } else {
      router.push('/');
    }
  };

  const handleSelectCategory = (id: string) => {
    const now = Date.now();
    // Ignore synthetic duplicate events for the exact same category chip within 100ms
    if (lastSelectedCategoryRef.current.id === id && now - lastSelectedCategoryRef.current.timestamp < 100) {
      return;
    }
    lastSelectedCategoryRef.current = { id, timestamp: now };
    onSelectCategory?.(id);
  };

  return (
    <View style={styles.fixedWrap}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            focusable={true}
            onPress={handleLogoPress}
            {...(Platform.OS === 'web'
              ? ({
                  onClick: (e: any) => {
                    e?.stopPropagation?.();
                    handleLogoPress();
                  },
                } as any)
              : {})}
            style={styles.logoBtn}
          >
            <Text style={styles.logoText} pointerEvents="none">{isMobile ? 'UMS' : siteName}</Text>
          </Pressable>

          <View style={styles.actions}>
            {/* Raccourcis Utilisateurs sur Desktop */}
            {!isMobile && currentUser ? (
              <View style={styles.userShortcutsRow}>
                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FAVORITES')}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: (e: any) => {
                          e?.stopPropagation?.();
                          navigateUserTab('FAVORITES');
                        },
                      } as any)
                    : {})}
                >
                  <Text style={styles.userNavPillTxt} pointerEvents="none">Favoris ({favoritesCount})</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FRIENDS')}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: (e: any) => {
                          e?.stopPropagation?.();
                          navigateUserTab('FRIENDS');
                        },
                      } as any)
                    : {})}
                >
                  <Text style={styles.userNavPillTxt} pointerEvents="none">Amis</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FORUMS')}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: (e: any) => {
                          e?.stopPropagation?.();
                          navigateUserTab('FORUMS');
                        },
                      } as any)
                    : {})}
                >
                  <Text style={styles.userNavPillTxt} pointerEvents="none">Salons</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={styles.userNavPill}
                  onPress={() => navigateUserTab('FEED')}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: (e: any) => {
                          e?.stopPropagation?.();
                          navigateUserTab('FEED');
                        },
                      } as any)
                    : {})}
                >
                  <Text style={styles.userNavPillTxt} pointerEvents="none">Fil d'avis</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              focusable={true}
              style={styles.tvBtn}
              onPress={() => handleDebouncedAction(() => router.push('/tv' as any))}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: any) => {
                      e?.stopPropagation?.();
                      handleDebouncedAction(() => router.push('/tv' as any));
                    },
                  } as any)
                : {})}
            >
              <Text style={styles.tvBtnText} pointerEvents="none">TV</Text>
            </Pressable>

            {currentUser ? (
              <Pressable
                focusable={true}
                style={styles.profileBtn}
                onPress={() => handleDebouncedAction(() => router.push('/user' as any))}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: (e: any) => {
                        e?.stopPropagation?.();
                        handleDebouncedAction(() => router.push('/user' as any));
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.profileBtnText} pointerEvents="none">
                  {currentUser.displayName}{currentUser.isAdmin ? ' • Admin' : ''}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                focusable={true}
                style={styles.loginBtn}
                onPress={() => handleDebouncedAction(() => router.push('/login' as any))}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: (e: any) => {
                        e?.stopPropagation?.();
                        handleDebouncedAction(() => router.push('/login' as any));
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.loginBtnText} pointerEvents="none">Connexion</Text>
              </Pressable>
            )}

            {currentUser?.isAdmin ? (
              <Pressable
                focusable={true}
                style={styles.adminBtn}
                onPress={() => handleDebouncedAction(() => router.push('/admin' as any))}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: (e: any) => {
                        e?.stopPropagation?.();
                        handleDebouncedAction(() => router.push('/admin' as any));
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.adminBtnText} pointerEvents="none">Admin</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Barre de navigation rapide utilisateur sur Mobile */}
        {isMobile && currentUser ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.mobileUserScroll}>
            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FAVORITES')}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: any) => {
                      e?.stopPropagation?.();
                      navigateUserTab('FAVORITES');
                    },
                  } as any)
                : {})}
            >
              <Text style={styles.userNavPillTxt} pointerEvents="none">Favoris ({favoritesCount})</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FRIENDS')}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: any) => {
                      e?.stopPropagation?.();
                      navigateUserTab('FRIENDS');
                    },
                  } as any)
                : {})}
            >
              <Text style={styles.userNavPillTxt} pointerEvents="none">Amis</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FORUMS')}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: any) => {
                      e?.stopPropagation?.();
                      navigateUserTab('FORUMS');
                    },
                  } as any)
                : {})}
            >
              <Text style={styles.userNavPillTxt} pointerEvents="none">Salons</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.userNavPill, styles.mobileUserPill]}
              onPress={() => navigateUserTab('FEED')}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: (e: any) => {
                      e?.stopPropagation?.();
                      navigateUserTab('FEED');
                    },
                  } as any)
                : {})}
            >
              <Text style={styles.userNavPillTxt} pointerEvents="none">Fil d'avis</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {categories.length > 0 && onSelectCategory ? (
          <View style={styles.secondTierRow}>
            <ScrollView
              ref={categoryScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.scroll}>

              {categories.map((cat) => {
                const isActive = activeCategoryId === cat.id;
                return (
                  <Pressable
                    focusable={true}
                    key={cat.id}
                    nativeID={`cat-chip-${cat.id}`}
                    {...(Platform.OS === 'web' ? { id: `cat-chip-${cat.id}` } : {})}
                    onPress={() => handleSelectCategory(cat.id)}
                    {...(Platform.OS === 'web'
                      ? ({
                          onClick: (e: any) => {
                            e?.stopPropagation?.();
                            handleSelectCategory(cat.id);
                          },
                        } as any)
                      : {})}
                    style={[styles.chip, isActive && styles.actChip]}>
                    {isActive ? <View style={styles.activeDot} pointerEvents="none" /> : null}
                    <Text style={[styles.chipTxt, isActive && styles.actTxt]} pointerEvents="none">{cat.title}</Text>
                    {isActive ? <View style={styles.activeUnderline} pointerEvents="none" /> : null}
                  </Pressable>
                );
              })}
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(42, 48, 58, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    position: 'relative',
    overflow: 'hidden',
    userSelect: 'none',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  actChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.5)',
    transform: [{ scale: 1.04 }],
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)',
        } as any)
      : {}),
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 6px #38bdf8',
        } as any)
      : {}),
  },
  chipTxt: {
    color: '#8e9ab0',
    fontSize: 11,
    fontWeight: '600',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'color 0.2s ease',
        } as any)
      : {}),
  },
  actTxt: {
    color: '#f0f9ff',
    fontWeight: '700',
  },
  activeUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '18%',
    right: '18%',
    height: 2,
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  userShortcutsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginRight: 4 },
  userNavPill: {
    backgroundColor: 'rgba(42, 48, 58, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    userSelect: 'none',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  userNavPillTxt: { color: '#c5cedb', fontSize: 11, fontWeight: '600' },
  mobileUserScroll: { gap: 6, paddingVertical: 2, paddingHorizontal: 2 },
  mobileUserPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tvBtn: {
    backgroundColor: 'rgba(55, 68, 85, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(140, 165, 195, 0.25)',
    userSelect: 'none',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  tvBtnText: { color: '#cbd5e1', fontWeight: '700', fontSize: 11 },
  loginBtn: {
    backgroundColor: '#3b4554',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    userSelect: 'none',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  loginBtnText: { color: '#edeef2', fontWeight: '600', fontSize: 11 },
  profileBtn: {
    backgroundColor: 'rgba(50, 60, 75, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(140, 165, 195, 0.22)',
    userSelect: 'none',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  profileBtnText: { color: '#cbd5e1', fontWeight: '700', fontSize: 11 },
  adminBtn: {
    backgroundColor: 'rgba(42, 48, 58, 0.6)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    userSelect: 'none',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  adminBtnText: { color: '#c5cedb', fontWeight: '600', fontSize: 11 },
});
