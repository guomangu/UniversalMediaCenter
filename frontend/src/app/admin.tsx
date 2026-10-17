import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { AccountModal } from '@/components/AccountModal';
import { useCurrentUser } from '@/services/authStore';
import { useTabState } from '@/hooks/useTabState';
import { styles } from '@/components/AdminScreen.styles';
import { AdminConfigTab } from '@/components/AdminConfigTab';
import { AdminProfileTypesTab } from '@/components/AdminProfileTypesTab';
import { AdminUsersTab } from '@/components/AdminUsersTab';
import { AdminLayoutTab } from '@/components/AdminLayoutTab';
import { AdminIptvTab } from '@/components/AdminIptvTab';
import { AdminScanTab } from '@/components/AdminScanTab';

type Tab = 'LIBRARY' | 'PROFILE_TYPES' | 'USERS' | 'LAYOUT' | 'CONFIG' | 'IPTV';

export default function AdminScreen() {
  const router = useRouter();
  const headerPaddingTop = useHeaderHeight(false);
  const currentUser = useCurrentUser();
  const [tab, setTab] = useTabState<Tab>('admin_active_tab', 'LIBRARY');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Garde de sécurité : seuls les administrateurs authentifiés peuvent voir et utiliser ce panneau
  if (!currentUser?.isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <SiteHeader />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: headerPaddingTop + 16 }}>
          <View style={[styles.card, { maxWidth: 440, width: '100%', alignItems: 'center' }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
            <Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 8 }]}>Accès Réservé aux Administrateurs</Text>
            <Text style={[styles.cardSub, { textAlign: 'center', marginBottom: 20 }]}>
              {currentUser
                ? `Vous êtes connecté en tant que "${currentUser.displayName}" (Membre standard). Seuls les administrateurs ont accès à cette interface.`
                : 'Vous naviguez en mode invité. Veuillez vous connecter avec un compte administrateur pour configurer le système.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <Pressable focusable={true} style={[styles.submitBtn, { flex: 1, backgroundColor: '#475569' }]} onPress={() => router.push('/')}>
                <Text style={styles.submitText}>🏠 Accueil</Text>
              </Pressable>
              <Pressable
                focusable={true}
                style={[styles.submitBtn, { flex: 1 }]}
                onPress={() => router.push({ pathname: '/login', params: { returnUrl: '/admin', error: 'Accès réservé aux administrateurs' } } as any)}
              >
                <Text style={styles.submitText}>🔑 Se connecter</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <AccountModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}>
        <Text style={styles.heading}>Panneau d’Administration Centralisé</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={styles.tabScroll}>
          {(['LIBRARY', 'PROFILE_TYPES', 'USERS', 'LAYOUT', 'CONFIG', 'IPTV'] as const).map((t) => (
            <Pressable
              key={t}
              focusable={true}
              style={[styles.tabBtn, tab === t && styles.activeTab]}
              onPress={() => setTab(t)}
            >
              <Text style={styles.tabText}>
                {t === 'LIBRARY'
                  ? '🚀 Scan & Médiathèque'
                  : t === 'PROFILE_TYPES'
                  ? '🏷️ Types de Profils'
                  : t === 'USERS'
                  ? '👥 Comptes'
                  : t === 'LAYOUT'
                  ? '🎨 Rails & Layout'
                  : t === 'CONFIG'
                  ? '⚙️ param.yaml'
                  : '📡 Sources IPTV'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'LIBRARY' && <AdminScanTab />}
        {tab === 'PROFILE_TYPES' && <AdminProfileTypesTab />}
        {tab === 'USERS' && <AdminUsersTab />}
        {tab === 'LAYOUT' && <AdminLayoutTab />}
        {tab === 'CONFIG' && <AdminConfigTab />}
        {tab === 'IPTV' && <AdminIptvTab />}
      </ScrollView>
    </SafeAreaView>
  );
}
