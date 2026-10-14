import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPublicConfig } from '@/services/adminApi';
import { QuickProfileModal } from './QuickProfileModal';
import { Radius, Spacing } from '@/constants/theme';

export function SiteHeader() {
  const router = useRouter();
  const [siteName, setSiteName] = useState('Universal Media Stack');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  useEffect(() => {
    fetchPublicConfig().then((cfg) => {
      if (cfg?.siteName) setSiteName(cfg.siteName);
    });
  }, []);

  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.push('/')}>
        <Text style={styles.logoText}>🎬 {siteName}</Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable style={styles.profileBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.profileBtnText}>
            {currentProfile ? `👤 ${currentProfile.displayName}` : '+ Créer un Profil'}
          </Text>
        </Pressable>

        <Pressable style={styles.adminBtn} onPress={() => router.push('/admin' as any)}>
          <Text style={styles.adminBtnText}>⚙️ Admin</Text>
        </Pressable>
      </View>

      <QuickProfileModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onProfileCreated={(user) => setCurrentProfile(user)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
    paddingHorizontal: 4,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  profileBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  profileBtnText: {
    color: '#a5b4fc',
    fontWeight: '700',
    fontSize: 12,
  },
  adminBtn: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  adminBtnText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 12,
  },
});
