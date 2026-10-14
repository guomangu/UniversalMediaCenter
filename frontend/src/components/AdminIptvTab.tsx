import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  fetchIptvSources,
  createIptvSource,
  syncIptvSource,
  deleteIptvSource,
  updateIptvSource,
} from '@/services/adminApi';
import { ConfirmModal } from './ConfirmModal';
import { Radius } from '@/constants/theme';

export function AdminIptvTab() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSources = async () => {
    setLoading(true);
    const list = await fetchIptvSources();
    setSources(list);
    setLoading(false);
  };

  useEffect(() => { loadSources(); }, []);

  const handleAdd = async () => {
    if (!name.trim() || !m3uUrl.trim()) {
      setStatusMsg('Le nom et l’URL M3U sont obligatoires.');
      return;
    }
    setActionLoading(true);
    const res = await createIptvSource({ name: name.trim(), m3uUrl: m3uUrl.trim(), epgXmltvUrl: epgUrl.trim() || undefined });
    setActionLoading(false);
    if (res.success) {
      setStatusMsg(`✅ Source ajoutée (${res.importedCount ?? 0} chaînes synchronisées)`);
      setName(''); setM3uUrl(''); setEpgUrl('');
      loadSources();
    } else {
      setStatusMsg(`❌ Erreur: ${res.error}`);
    }
  };

  const handleSync = async (id: string) => {
    setActionLoading(true);
    const res = await syncIptvSource(id);
    setActionLoading(false);
    setStatusMsg(res.success ? `✅ ${res.message}` : `❌ ${res.error}`);
    loadSources();
  };

  const handleToggle = async (src: any) => {
    await updateIptvSource(src.id, { isActive: !src.isActive });
    loadSources();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    await deleteIptvSource(deleteTarget.id);
    setActionLoading(false);
    setDeleteTarget(null);
    loadSources();
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>Gestion des Sources IPTV (.m3u / XMLTV)</Text>
      <Text style={s.sub}>Importez et gérez vos flux TV en direct et grilles de programmes.</Text>

      <View style={s.form}>
        <TextInput style={s.input} placeholder="Nom du bouquet (ex: TNT HD)" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
        <TextInput style={s.input} placeholder="URL Playlist (.m3u / .m3u8)" placeholderTextColor="#64748b" value={m3uUrl} onChangeText={setM3uUrl} />
        <TextInput style={s.input} placeholder="URL Guide EPG (.xml / .xmltv optionnel)" placeholderTextColor="#64748b" value={epgUrl} onChangeText={setEpgUrl} />
        <Pressable focusable={true} style={[s.btn, s.btnPrimary]} onPress={handleAdd} disabled={actionLoading}>
          {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>📡 Ajouter & Synchroniser</Text>}
        </Pressable>
        {statusMsg ? <Text style={s.status}>{statusMsg}</Text> : null}
      </View>

      <Text style={[s.title, { marginTop: 24, fontSize: 16 }]}>Sources enregistrées ({sources.length})</Text>
      {loading ? <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} /> : sources.map((src) => (
        <View key={src.id} style={s.sourceRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.srcName}>{src.name}</Text>
              <Text style={[s.badge, { backgroundColor: src.isActive ? '#065f46' : '#991b1b' }]}>
                {src.isActive ? 'Actif' : 'Inactif'}
              </Text>
            </View>
            <Text style={s.srcUrl} numberOfLines={1}>{src.m3uUrl}</Text>
            {src.lastSyncedAt && <Text style={s.synced}>Dernière synchro: {new Date(src.lastSyncedAt).toLocaleString()}</Text>}
          </View>
          <View style={s.rowActions}>
            <Pressable focusable={true} style={[s.btnSmall, { backgroundColor: '#334155' }]} onPress={() => handleToggle(src)}>
              <Text style={s.btnSmallText}>{src.isActive ? 'Désactiver' : 'Activer'}</Text>
            </Pressable>
            <Pressable focusable={true} style={[s.btnSmall, { backgroundColor: '#4f46e5' }]} onPress={() => handleSync(src.id)}>
              <Text style={s.btnSmallText}>🔄 Synchro</Text>
            </Pressable>
            <Pressable focusable={true} style={[s.btnSmall, { backgroundColor: '#ef4444' }]} onPress={() => setDeleteTarget(src)}>
              <Text style={s.btnSmallText}>🗑️</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <ConfirmModal
        visible={!!deleteTarget}
        title="Supprimer la source IPTV"
        message={`Confirmez-vous la suppression de la source "${deleteTarget?.name}" ?`}
        confirmText="Supprimer"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#1e293b', borderRadius: Radius.lg || 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  title: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  sub: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  form: { gap: 10 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, color: '#f8fafc', fontSize: 14 },
  btn: { padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#6366f1' },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  status: { color: '#38bdf8', fontSize: 13, marginTop: 4 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: 14, borderRadius: 10, marginTop: 10, gap: 12 },
  srcName: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  srcUrl: { color: '#64748b', fontSize: 12, marginTop: 2 },
  synced: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: '#fff', fontSize: 10, fontWeight: '700' },
  rowActions: { flexDirection: 'row', gap: 6 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  btnSmallText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
