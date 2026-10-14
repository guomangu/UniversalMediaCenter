import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPublicConfig } from '@/services/adminApi';
import { QuickProfileModal } from './QuickProfileModal';
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
  const [siteName, setSiteName] = useState('Universal Media Stack');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  useEffect(() => {
    fetchPublicConfig().then((cfg) => { if (cfg?.siteName) setSiteName(cfg.siteName); });
  }, []);

  return (
    <View style={styles.fixedWrap}>
      <View style={styles.header}>
        <Pressable onPress={onScrollToTop || (() => router.push('/'))} style={styles.logoBtn}>
          <Text style={styles.logoText}>🎬 {siteName}</Text>
        </Pressable>

        {categories.length > 0 && onSelectCategory ? (
          <View style={styles.shortcutsWrap}>
            {onScrollToTop ? (
              <Pressable onPress={onScrollToTop} style={styles.homeBtn}>
                <Text style={styles.homeTxt}>🏠 Haut</Text>
              </Pressable>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {categories.map((cat) => (
                <Pressable key={cat.id} onPress={() => onSelectCategory(cat.id)} style={[styles.chip, activeCategoryId === cat.id && styles.actChip]}>
                  <Text style={[styles.chipTxt, activeCategoryId === cat.id && styles.actTxt]}>{cat.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={styles.profileBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.profileBtnText}>{currentProfile ? `👤 ${currentProfile.displayName}` : '+ Profil'}</Text>
          </Pressable>
          <Pressable style={styles.adminBtn} onPress={() => router.push('/admin' as any)}>
            <Text style={styles.adminBtnText}>⚙️ Admin</Text>
          </Pressable>
        </View>

        <QuickProfileModal visible={modalVisible} onClose={() => setModalVisible(false)} onProfileCreated={(u) => setCurrentProfile(u)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fixedWrap: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0, left: 0, right: 0, zIndex: 1000,
    backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(99, 102, 241, 0.35)',
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: MaxContentWidth, width: '100%', gap: 8 },
  logoBtn: { cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  logoText: { fontSize: 16, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 },
  shortcutsWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, minWidth: 120 },
  homeBtn: { backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, marginRight: 6 },
  homeTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '800' },
  scroll: { gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(51, 65, 85, 0.55)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.35)' },
  actChip: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  chipTxt: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  actTxt: { color: '#ffffff', fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  profileBtn: { backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.4)' },
  profileBtnText: { color: '#a5b4fc', fontWeight: '700', fontSize: 11 },
  adminBtn: { backgroundColor: 'rgba(51, 65, 85, 0.6)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill },
  adminBtnText: { color: '#e2e8f0', fontWeight: '600', fontSize: 11 },
});
