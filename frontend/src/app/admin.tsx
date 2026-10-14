import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<'LAYOUT' | 'IPTV'>('LAYOUT');
  const [sourceName, setSourceName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const handleAddIptv = async () => {
    if (!sourceName || !m3uUrl) {
      setStatusMsg('Veuillez remplir les 2 champs.');
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/iptv/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sourceName, m3uUrl }),
      });
      const data = await res.json();
      setStatusMsg(data.success ? `✅ ${data.importedCount} chaînes synchronisées !` : `❌ ${data.error}`);
      setSourceName('');
      setM3uUrl('');
    } catch (err: any) {
      setStatusMsg(`Erreur : ${err.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Studio d'Administration (Server-Driven UI)</Text>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'LAYOUT' && styles.activeTab]}
            onPress={() => setActiveTab('LAYOUT')}>
            <Text style={styles.tabText}>📐 Disposition des Rails</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === 'IPTV' && styles.activeTab]}
            onPress={() => setActiveTab('IPTV')}>
            <Text style={styles.tabText}>📡 Sources IPTV & EPG</Text>
          </Pressable>
        </View>

        {activeTab === 'LAYOUT' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rails d'Accueil Actifs</Text>
            <Text style={styles.cardSub}>Chaque rail est piloté à chaud depuis PostgreSQL.</Text>
            {['1. À l\'Affiche (Hero Spotlight)', '2. Reprendre la Lecture', '3. Derniers Ajouts', '4. Chaînes TV en Direct', '5. Sagas & Franchises', '6. Cinéma 4K HDR'].map((r, i) => (
              <View key={i} style={styles.railRow}>
                <Text style={styles.railText}>{r}</Text>
                <View style={styles.statusPill}><Text style={styles.statusText}>Actif</Text></View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ajouter une Liste IPTV (.m3u)</Text>
            <Text style={styles.cardSub}>Formulaire contextuel (2 champs max).</Text>
            <TextInput style={styles.input} placeholder="Nom (ex: Freebox TV / GitHub IPTV)" placeholderTextColor="#64748b" value={sourceName} onChangeText={setSourceName} />
            <TextInput style={styles.input} placeholder="URL M3U8 (https://...)" placeholderTextColor="#64748b" value={m3uUrl} onChangeText={setM3uUrl} />
            <Pressable style={styles.submitBtn} onPress={handleAddIptv}>
              <Text style={styles.submitText}>+ Importer & Synchroniser</Text>
            </Pressable>
            {statusMsg ? <Text style={styles.statusMsg}>{statusMsg}</Text> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', padding: Spacing.four },
  heading: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginBottom: Spacing.three },
  tabRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four },
  tabBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: 'rgba(51, 65, 85, 0.5)' },
  activeTab: { backgroundColor: '#6366f1' },
  tabText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.75)', borderRadius: Radius.md, padding: Spacing.four, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#94a3b8', marginBottom: Spacing.three },
  railRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: 'rgba(51, 65, 85, 0.3)' },
  railText: { color: '#f1f5f9', fontSize: 14 },
  statusPill: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { color: '#34d399', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.5)', borderRadius: Radius.md, padding: Spacing.two + 2, color: '#f8fafc', marginBottom: Spacing.two },
  submitBtn: { backgroundColor: '#6366f1', paddingVertical: Spacing.two + 2, borderRadius: Radius.pill, alignItems: 'center', marginTop: Spacing.one },
  submitText: { color: '#ffffff', fontWeight: '700' },
  statusMsg: { marginTop: Spacing.two, color: '#a5b4fc', fontSize: 13, textAlign: 'center' },
});
