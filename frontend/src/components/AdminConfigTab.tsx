import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Switch } from 'react-native';
import { fetchSiteConfig, updateSiteConfig } from '@/services/adminApi';
import { styles } from './AdminScreen.styles';

export function AdminConfigTab() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newExcludedFolder, setNewExcludedFolder] = useState('');

  useEffect(() => {
    fetchSiteConfig().then((data) => data && setConfig(data));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setLoading(true);
    setStatus('Synchronisation avec param.yaml...');
    const res = await updateSiteConfig(config);
    setLoading(false);
    setStatus(res.success ? '✅ Synchronisé avec param.yaml !' : `❌ ${res.error}`);
  };

  const addCode = () => {
    if (!newCode.trim() || !config) return;
    const codes = [...(config.security?.invitationCodes || []), newCode.trim().toUpperCase()];
    setConfig({ ...config, security: { ...config.security, invitationCodes: codes } });
    setNewCode('');
  };

  const removeCode = (target: string) => {
    if (!config) return;
    const codes = (config.security?.invitationCodes || []).filter((c: string) => c !== target);
    setConfig({ ...config, security: { ...config.security, invitationCodes: codes } });
  };

  const addFolder = () => {
    if (!newExcludedFolder.trim() || !config) return;
    const folders = [...(config.media?.globalExcludedFolders || []), newExcludedFolder.trim()];
    setConfig({ ...config, media: { ...config.media, globalExcludedFolders: folders } });
    setNewExcludedFolder('');
  };

  const removeFolder = (target: string) => {
    if (!config) return;
    const folders = (config.media?.globalExcludedFolders || []).filter((f: string) => f !== target);
    setConfig({ ...config, media: { ...config.media, globalExcludedFolders: folders } });
  };

  if (!config) return <ActivityIndicator color="#6366f1" style={{ marginVertical: 30 }} />;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>⚙️ Configuration Globale & Dynamique (param.yaml)</Text>
      <Text style={styles.cardSub}>Personnalisez la plateforme, les règles de profils par défaut et l’indexation.</Text>

      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Nom de la Plateforme</Text>
      <TextInput
        style={styles.input}
        value={config.server?.siteName || ''}
        onChangeText={(t) => setConfig({ ...config, server: { ...config.server, siteName: t } })}
      />

      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Slogan / Sous-titre</Text>
      <TextInput
        style={styles.input}
        value={config.server?.siteTagline || ''}
        onChangeText={(t) => setConfig({ ...config, server: { ...config.server, siteTagline: t } })}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 13 }}>Mode Invitation Uniquement</Text>
          <Text style={{ color: '#94a3b8', fontSize: 11 }}>Bloque la création libre de profil sans code valide</Text>
        </View>
        <Switch
          value={Boolean(config.security?.invitationOnly)}
          onValueChange={(val) => setConfig({ ...config, security: { ...config.security, invitationOnly: val } })}
          trackColor={{ false: '#334155', true: '#6366f1' }}
        />
      </View>

      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, marginBottom: 4 }}>Codes d’invitation actifs</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {(config.security?.invitationCodes || []).map((code: string) => (
          <Pressable key={code} onPress={() => removeCode(code)} style={styles.statusPill}>
            <Text style={styles.statusText}>{code} ✕</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Nouveau code (ex: VIP-2026)"
          placeholderTextColor="#64748b"
          value={newCode}
          onChangeText={setNewCode}
        />
        <Pressable style={[styles.submitBtn, { paddingHorizontal: 16 }]} onPress={addCode}>
          <Text style={styles.submitText}>+ Code</Text>
        </Pressable>
      </View>

      {/* Dossiers exclus globalement */}
      <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
        📁 Dossiers Ignorés de l’Indexation Globale
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {(config.media?.globalExcludedFolders || []).map((folder: string) => (
          <Pressable key={folder} onPress={() => removeFolder(folder)} style={[styles.statusPill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
            <Text style={[styles.statusText, { color: '#fbbf24' }]}>📁 {folder} ✕</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Dossier à exclure (ex: .git, @eaDir, Corbeille)"
          placeholderTextColor="#64748b"
          value={newExcludedFolder}
          onChangeText={setNewExcludedFolder}
        />
        <Pressable style={[styles.submitBtn, { paddingHorizontal: 16, backgroundColor: '#f59e0b' }]} onPress={addFolder}>
          <Text style={styles.submitText}>+ Exclure</Text>
        </Pressable>
      </View>

      {/* Rôles et Variables par Défaut pour les Nouveaux Profils */}
      <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
        👥 Variables et Permissions par Défaut des Profils
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Rôle par défaut</Text>
          <TextInput
            style={styles.input}
            value={config.profiles?.defaultRole || 'STANDARD'}
            onChangeText={(t) => setConfig({ ...config, profiles: { ...config.profiles, defaultRole: t } })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Âge CSA max par défaut</Text>
          <TextInput
            style={styles.input}
            placeholder="Aucun (libre)"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={config.profiles?.defaultMaxCsaAge ? String(config.profiles.defaultMaxCsaAge) : ''}
            onChangeText={(t) => setConfig({ ...config, profiles: { ...config.profiles, defaultMaxCsaAge: t ? Number(t) : null } })}
          />
        </View>
      </View>

      <Pressable style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>💾 Enregistrer dans param.yaml</Text>}
      </Pressable>
      {status ? <Text style={styles.statusMsg}>{status}</Text> : null}
    </View>
  );
}
