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
      <Text style={styles.cardSub}>Personnalisez la plateforme, les règles de profils par défaut, l’indexation et les langues.</Text>

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
          <Pressable
            key={code}
            focusable={true}
            onPress={() => removeCode(code)}
            style={styles.statusPill}
          >
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
        <Pressable
          focusable={true}
          style={[styles.submitBtn, { paddingHorizontal: 16 }]}
          onPress={addCode}
        >
          <Text style={styles.submitText}>+ Code</Text>
        </Pressable>
      </View>

      {/* Dossiers exclus globalement */}
      <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
        📁 Dossiers Ignorés de l’Indexation Globale
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {(config.media?.globalExcludedFolders || []).map((folder: string) => (
          <Pressable
            key={folder}
            focusable={true}
            onPress={() => removeFolder(folder)}
            style={[styles.statusPill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}
          >
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
        <Pressable
          focusable={true}
          style={[styles.submitBtn, { paddingHorizontal: 16, backgroundColor: '#f59e0b' }]}
          onPress={addFolder}
        >
          <Text style={styles.submitText}>+ Exclure</Text>
        </Pressable>
      </View>

      {/* 🎬 Langues et Sous-titres par Défaut des Médias */}
      <View style={{ marginTop: 8, marginBottom: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.4)' }}>
        <Text style={{ color: '#cbd5e1', fontSize: 14, fontWeight: '800', marginBottom: 4 }}>
          🎬 Langues & Sous-Titres par Défaut des Médias
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
          Configurez les langues prioritaires et l'activation automatique des sous-titres (ex: VOSTFR intelligent si la VF est absente).
        </Text>

        {/* 1. Langue Audio par Défaut */}
        <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
          🔊 Langue Audio par Défaut
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
          Piste audio sélectionnée en priorité (ex: fra, eng, jpn ou codes multiples séparés par une virgule).
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Code langue (ex: fra, fre, fr)"
          placeholderTextColor="#64748b"
          value={config.media?.defaultAudioLanguage || ''}
          onChangeText={(t) => setConfig({ ...config, media: { ...config.media, defaultAudioLanguage: t } })}
        />
        {/* Presets rapides de langue audio */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[
            { label: '🇫🇷 Français (fra)', code: 'fra' },
            { label: '🇬🇧 Anglais (eng)', code: 'eng' },
            { label: '🇯🇵 Japonais (jpn)', code: 'jpn' },
            { label: '🇪🇸 Espagnol (spa)', code: 'spa' },
            { label: '🇩🇪 Allemand (deu)', code: 'deu' },
            { label: '🇮🇹 Italien (ita)', code: 'ita' },
          ].map((item) => {
            const isSelected = (config.media?.defaultAudioLanguage || '').toLowerCase().includes(item.code);
            return (
              <Pressable
                key={item.code}
                focusable={true}
                onPress={() => setConfig({ ...config, media: { ...config.media, defaultAudioLanguage: item.code } })}
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(51, 65, 85, 0.4)',
                    borderWidth: 1,
                    borderColor: isSelected ? '#6366f1' : 'rgba(100, 116, 139, 0.3)',
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                  },
                ]}
              >
                <Text style={{ color: isSelected ? '#a5b4fc' : '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 2. Langue des Sous-titres par Défaut */}
        <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
          💬 Langue des Sous-Titres par Défaut
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
          Langue des sous-titres recherchée dans les pistes intégrées ou les fichiers externes (.srt, .vtt).
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Code sous-titres (ex: fra, fre, fr)"
          placeholderTextColor="#64748b"
          value={config.media?.defaultSubtitleLanguage || ''}
          onChangeText={(t) => setConfig({ ...config, media: { ...config.media, defaultSubtitleLanguage: t } })}
        />
        {/* Presets rapides de langue sous-titres */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[
            { label: '🇫🇷 Français (fra)', code: 'fra' },
            { label: '🇬🇧 Anglais (eng)', code: 'eng' },
            { label: '🇪🇸 Espagnol (spa)', code: 'spa' },
            { label: '🇩🇪 Allemand (deu)', code: 'deu' },
            { label: '🇯🇵 Japonais (jpn)', code: 'jpn' },
          ].map((item) => {
            const isSelected = (config.media?.defaultSubtitleLanguage || '').toLowerCase().includes(item.code);
            return (
              <Pressable
                key={item.code}
                focusable={true}
                onPress={() => setConfig({ ...config, media: { ...config.media, defaultSubtitleLanguage: item.code } })}
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(51, 65, 85, 0.4)',
                    borderWidth: 1,
                    borderColor: isSelected ? '#6366f1' : 'rgba(100, 116, 139, 0.3)',
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                  },
                ]}
              >
                <Text style={{ color: isSelected ? '#a5b4fc' : '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 3. Règle d'activation des Sous-titres */}
        <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
          ⚙️ Règle d'Activation Automatique des Sous-Titres
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
          Choisissez quand les sous-titres doivent être engagés par défaut au lancement de la vidéo.
        </Text>

        <View style={{ gap: 8, marginBottom: 14 }}>
          {[
            {
              id: 'fallback_if_audio_missing',
              icon: '🎯',
              badge: 'Recommandé (VOSTFR)',
              title: "Activer si l'audio par défaut est absent (VOST)",
              desc: "Engage automatiquement les sous-titres par défaut uniquement si la piste audio par défaut n'existe pas dans le média.",
            },
            {
              id: 'always',
              icon: '👁️',
              badge: 'Systématique',
              title: 'Toujours activer les sous-titres par défaut',
              desc: 'Active immédiatement les sous-titres dans la langue par défaut pour tous les médias lus.',
            },
            {
              id: 'never',
              icon: '🔇',
              badge: 'Manuel uniquement',
              title: 'Désactivé par défaut',
              desc: 'Les sous-titres restent éteints par défaut et ne sont affichés que si le spectateur clique sur ST.',
            },
          ].map((mode) => {
            const currentMode = config.media?.subtitleMode || 'fallback_if_audio_missing';
            const isSelected = currentMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                focusable={true}
                onPress={() => setConfig({ ...config, media: { ...config.media, subtitleMode: mode.id } })}
                style={{
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                  borderWidth: 1,
                  borderColor: isSelected ? '#6366f1' : 'rgba(71, 85, 105, 0.4)',
                  borderRadius: 10,
                  padding: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 20 }}>{mode.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={{ color: isSelected ? '#ffffff' : '#e2e8f0', fontSize: 13, fontWeight: '700' }}>
                      {mode.title}
                    </Text>
                    {mode.badge && (
                      <View style={{ backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(51, 65, 85, 0.5)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: isSelected ? '#a5b4fc' : '#94a3b8', fontSize: 10, fontWeight: '700' }}>
                          {mode.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: '#94a3b8', fontSize: 11, lineHeight: 15 }}>
                    {mode.desc}
                  </Text>
                </View>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: isSelected ? '#6366f1' : '#64748b',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSelected && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1' }} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
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

      <Pressable
        focusable={true}
        style={[styles.submitBtn, loading && styles.btnDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>💾 Enregistrer dans param.yaml</Text>}
      </Pressable>
      {status ? <Text style={styles.statusMsg}>{status}</Text> : null}
    </View>
  );
}
