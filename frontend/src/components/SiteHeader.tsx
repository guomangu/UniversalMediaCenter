import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPublicConfig } from '@/services/adminApi';
import { useCurrentUser } from '@/services/authStore';
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
  const isMobile = width < 768;
  const [siteName, setSiteName] = useState('Universal Media Stack');
  const [modalVisible, setModalVisible] = useState(false);
  const currentUser = useCurrentUser();

  useEffect(() => {
    fetchPublicConfig().then((cfg) => { if (cfg?.siteName) setSiteName(cfg.siteName); });
  }, []);

  return (
    <View style={styles.fixedWrap}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable focusable={true} onPress={onScrollToTop || (() => router.push('/'))} style={styles.logoBtn}>
            <Text style={styles.logoText}>🎬 {isMobile ? 'UMS' : siteName}</Text>
          </Pressable>
          <View style={styles.actions}>
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
  tvBtn: { backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: '#6366f1' },
  tvBtnText: { color: '#c7d2fe', fontWeight: '800', fontSize: 11 },
  loginBtn: { backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  loginBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },
  profileBtn: { backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.45)' },
  profileBtnText: { color: '#c7d2fe', fontWeight: '800', fontSize: 11 },
  adminBtn: { backgroundColor: 'rgba(51, 65, 85, 0.6)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill },
  adminBtnText: { color: '#e2e8f0', fontWeight: '600', fontSize: 11 },
});
