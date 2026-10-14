import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteHeader } from '@/components/SiteHeader';
import { AccountModal } from '@/components/AccountModal';
import { useCurrentUser } from '@/services/authStore';
import { triggerLibraryRefresh } from '@/services/api';
import { getApiBaseUrl } from '@/services/apiConfig';
import { styles } from '@/components/AdminScreen.styles';
import { AdminConfigTab } from '@/components/AdminConfigTab';
import { AdminUsersTab } from '@/components/AdminUsersTab';
import { Radius } from '@/constants/theme';

type Tab = 'CONFIG' | 'USERS' | 'LIBRARY' | 'IPTV';

export default function AdminScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<Tab>('CONFIG');
  const [sourceName, setSourceName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
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

  const handleAddIptv = async () => {
    if (!sourceName || !m3uUrl) { setStatusMsg('Veuillez remplir les 2 champs.'); return; }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/iptv/sources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sourceName, m3uUrl }),
      });
      const data = await res.json();
      setStatusMsg(data.success ? `✅ ${data.importedCount} chaînes synchronisées !` : `❌ ${data.error}`);
      setSourceName(''); setM3uUrl('');
    } catch (err: any) { setStatusMsg(`Erreur : ${err.message}`); }
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
          {(['CONFIG', 'USERS', 'LIBRARY', 'IPTV'] as const).map((t) => (
            <Pressable key={t} style={[styles.tabBtn, tab === t && styles.activeTab]} onPress={() => setTab(t)}>
              <Text style={styles.tabText}>
                {t === 'CONFIG' ? '⚙️ param.yaml' : t === 'USERS' ? '👥 Comptes' : t === 'LIBRARY' ? '🔄 Scan' : '📡 IPTV'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'CONFIG' && <AdminConfigTab />}
        {tab === 'USERS' && <AdminUsersTab />}

        {tab === 'LIBRARY' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mise à jour & Complétion Intelligente</Text>
            <Text style={styles.cardSub}>Scanne par priorité de besoin (incomplets en premier) et met à jour champs manquants et existants.</Text>
            <Pressable style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleRefreshLibrary} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>🔄 Mettre à jour la médiathèque</Text>}
            </Pressable>
            {statusMsg ? <Text style={styles.statusMsg}>{statusMsg}</Text> : null}
          </View>
        )}

        {tab === 'IPTV' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ajouter un Fournisseur IPTV (.m3u)</Text>
            <Text style={styles.cardSub}>Importation automatique des flux et des guides EPG XMLTV.</Text>
            <TextInput style={styles.input} placeholder="Nom (ex: Freebox TV)" placeholderTextColor="#64748b" value={sourceName} onChangeText={setSourceName} />
            <TextInput style={styles.input} placeholder="URL Playlist .m3u" placeholderTextColor="#64748b" value={m3uUrl} onChangeText={setM3uUrl} />
            <Pressable style={styles.submitBtn} onPress={handleAddIptv}>
              <Text style={styles.submitText}>📡 Synchroniser les Chaînes</Text>
            </Pressable>
            {statusMsg ? <Text style={styles.statusMsg}>{statusMsg}</Text> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
