import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Switch } from 'react-native';
import { fetchSiteConfig, updateSiteConfig } from '@/services/adminApi';
import { styles } from './AdminScreen.styles';

export function AdminConfigTab() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [newCode, setNewCode] = useState('');

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

  const addInvitationCode = () => {
    if (!newCode.trim() || !config) return;
    const codes = [...(config.security.invitationCodes || []), newCode.trim().toUpperCase()];
    setConfig({ ...config, security: { ...config.security, invitationCodes: codes } });
    setNewCode('');
  };

  const removeCode = (target: string) => {
    if (!config) return;
    const codes = config.security.invitationCodes.filter((c: string) => c !== target);
    setConfig({ ...config, security: { ...config.security, invitationCodes: codes } });
  };

  if (!config) return <ActivityIndicator color="#6366f1" style={{ marginVertical: 30 }} />;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>⚙️ Configuration Centrale (param.yaml)</Text>
      <Text style={styles.cardSub}>Modifiable par l’Admin et synchronisé en temps réel avec param.yaml.</Text>

      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Nom du Site</Text>
      <TextInput
        style={styles.input}
        value={config.server.siteName}
        onChangeText={(t) => setConfig({ ...config, server: { ...config.server, siteName: t } })}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 14 }}>Mode Sur Invitation Seule</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Bloque la création libre à la volée sans code</Text>
        </View>
        <Switch
          value={config.security.invitationOnly}
          onValueChange={(val) => setConfig({ ...config, security: { ...config.security, invitationOnly: val } })}
          trackColor={{ false: '#334155', true: '#6366f1' }}
        />
      </View>

      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, marginBottom: 4 }}>Codes d’invitation actifs</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {(config.security.invitationCodes || []).map((code: string) => (
          <Pressable key={code} onPress={() => removeCode(code)} style={styles.statusPill}>
            <Text style={styles.statusText}>{code} ✕</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Nouveau code (ex: VIP-2026)"
          placeholderTextColor="#64748b"
          value={newCode}
          onChangeText={setNewCode}
        />
        <Pressable style={[styles.submitBtn, { paddingHorizontal: 16 }]} onPress={addInvitationCode}>
          <Text style={styles.submitText}>+ Ajouter</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>💾 Enregistrer dans param.yaml</Text>}
      </Pressable>
      {status ? <Text style={styles.statusMsg}>{status}</Text> : null}
    </View>
  );
}
