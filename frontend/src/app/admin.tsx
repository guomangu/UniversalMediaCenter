import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SiteHeader } from '@/components/SiteHeader';
import { AccountModal } from '@/components/AccountModal';
import { useCurrentUser } from '@/services/authStore';
import { triggerLibraryRefresh } from '@/services/api';
import { styles } from '@/components/AdminScreen.styles';
import { AdminConfigTab } from '@/components/AdminConfigTab';
import { AdminProfileTypesTab } from '@/components/AdminProfileTypesTab';
import { AdminUsersTab } from '@/components/AdminUsersTab';
import { AdminIptvTab } from '@/components/AdminIptvTab';

type Tab = 'CONFIG' | 'PROFILE_TYPES' | 'USERS' | 'LIBRARY' | 'IPTV';

export default function AdminScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<Tab>('PROFILE_TYPES');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleRefreshLibrary = async () => {
    setLoading(true);
    setStatusMsg('Analyse et enrichissement prioritaire des métadonnées en cours...');
    const res = await triggerLibraryRefresh(50);
    setLoading(false);
    setStatusMsg(res.success ? `✅ ${res.message}` : `❌ Échec : ${res.error}`);
  };

  // Garde de sécurité : seuls les administrateurs authentifiés peuvent voir et utiliser ce panneau
  if (!currentUser?.isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <SiteHeader />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 80 }}>
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Panneau d’Administration Centralisé</Text>
        <View style={styles.tabRow}>
          {(['PROFILE_TYPES', 'USERS', 'CONFIG', 'LIBRARY', 'IPTV'] as const).map((t) => (
            <Pressable
              key={t}
              focusable={true}
              style={[styles.tabBtn, tab === t && styles.activeTab]}
              onPress={() => setTab(t)}
            >
              <Text style={styles.tabText}>
                {t === 'PROFILE_TYPES'
                  ? '🏷️ Types de Profils'
                  : t === 'USERS'
                  ? '👥 Comptes'
                  : t === 'CONFIG'
                  ? '⚙️ param.yaml'
                  : t === 'LIBRARY'
                  ? '🔄 Scan'
                  : '📡 Sources IPTV'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'PROFILE_TYPES' && <AdminProfileTypesTab />}
        {tab === 'USERS' && <AdminUsersTab />}
        {tab === 'CONFIG' && <AdminConfigTab />}

        {tab === 'LIBRARY' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mise à jour & Complétion Intelligente</Text>
            <Text style={styles.cardSub}>Scanne par priorité de besoin (incomplets en premier) et met à jour champs manquants et existants.</Text>
            <Pressable
              focusable={true}
              style={[styles.submitBtn, loading && styles.btnDisabled]}
              onPress={handleRefreshLibrary}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>🔄 Mettre à jour la médiathèque</Text>}
            </Pressable>
            {statusMsg ? <Text style={styles.statusMsg}>{statusMsg}</Text> : null}
          </View>
        )}

        {tab === 'IPTV' && <AdminIptvTab />}
      </ScrollView>
    </SafeAreaView>
  );
}
