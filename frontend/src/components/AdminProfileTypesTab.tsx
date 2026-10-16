import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Switch, StyleSheet } from 'react-native';
import { fetchProfileTypes, createProfileType, updateProfileType, deleteProfileType } from '@/services/adminApi';
import { AdminUserTagManager } from './AdminUserTagManager';
import { ConfirmModal } from './ConfirmModal';
import { Radius } from '@/constants/theme';

export function AdminProfileTypesTab() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Formulaire d'édition / création
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [canDownload, setCanDownload] = useState(true);
  const [canWatchIptv, setCanWatchIptv] = useState(true);
  const [csaAge, setCsaAge] = useState('');
  const [allowedTags, setAllowedTags] = useState<string[]>([]);
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [allowedFolders, setAllowedFolders] = useState<string[]>([]);
  const [blockedFolders, setBlockedFolders] = useState<string[]>([]);

  const loadTypes = async () => {
    setLoading(true);
    const list = await fetchProfileTypes();
    setTypes(list);
    setLoading(false);
  };

  useEffect(() => { loadTypes(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setId(''); setLabel(''); setDesc('');
    setIsAdmin(false); setCanDownload(true); setCanWatchIptv(true); setCsaAge('');
    setAllowedTags([]); setBlockedTags([]); setAllowedFolders([]); setBlockedFolders([]);
  };

  const handleEdit = (pt: any) => {
    setEditingId(pt.id);
    setId(pt.id);
    setLabel(pt.label || '');
    setDesc(pt.description || '');
    setIsAdmin(Boolean(pt.isAdmin));
    setCanDownload(pt.canDownload !== false);
    setCanWatchIptv(pt.canWatchIptv !== false);
    setCsaAge(pt.maxCsaAgeLimit ? String(pt.maxCsaAgeLimit) : '');
    setAllowedTags(pt.allowedTags || []);
    setBlockedTags(pt.blockedTags || []);
    setAllowedFolders(pt.allowedFolders || []);
    setBlockedFolders(pt.blockedFolders || []);
  };

  const isEditingAdmin = editingId === 'ADMINISTRATEUR' || id === 'ADMINISTRATEUR';

  const handleSave = async () => {
    if (!id.trim() || !label.trim()) {
      setMsg('L’identifiant et le nom sont requis.');
      return;
    }
    setActionLoading(true);
    const cleanId = id.trim().toUpperCase();
    const isTargetAdmin = cleanId === 'ADMINISTRATEUR';

    const payload = {
      id: cleanId,
      label: label.trim(),
      description: desc.trim() || undefined,
      isAdmin: isTargetAdmin ? true : isAdmin,
      canDownload: isTargetAdmin ? true : canDownload,
      canWatchIptv: isTargetAdmin ? true : canWatchIptv,
      maxCsaAgeLimit: isTargetAdmin ? null : (csaAge ? Number(csaAge) : null),
      allowedTags: isTargetAdmin ? [] : allowedTags,
      blockedTags: isTargetAdmin ? [] : blockedTags,
      allowedFolders: isTargetAdmin ? [] : allowedFolders,
      blockedFolders: isTargetAdmin ? [] : blockedFolders,
    };

    const res = editingId
      ? await updateProfileType(editingId, payload)
      : await createProfileType(payload);
    setActionLoading(false);

    if (res.success) {
      setMsg(`✅ Pack de profil ${label} sauvegardé avec succès !`);
      resetForm();
      loadTypes();
    } else {
      setMsg(`❌ Erreur: ${res.error}`);
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    setActionLoading(true);
    const res = await deleteProfileType(typeToDelete.id);
    setActionLoading(false);
    setTypeToDelete(null);
    if (res.success) {
      setMsg(`✅ Type de profil supprimé.`);
      loadTypes();
    } else {
      setMsg(`❌ Erreur: ${res.error}`);
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>🏷️ Types de Profils & Packs Paramétrables</Text>
      <Text style={s.sub}>
        Définissez des modèles de profils (Enfant, Safezone, Pack Marvel, Membre, Admin) et associez-les aux utilisateurs avec filtrage par dossiers physiques et tags.
      </Text>

      {/* Liste des Packs Existants */}
      {loading ? <ActivityIndicator color="#6366f1" style={{ marginVertical: 16 }} /> : null}
      <View style={{ gap: 10, marginBottom: 20 }}>
        {types.map((pt) => {
          const isPtAdmin = pt.id === 'ADMINISTRATEUR' || pt.isAdmin;
          return (
            <View key={pt.id} style={s.typeRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={s.typeName}>{pt.label}</Text>
                  <Text style={s.typeCode}>[{pt.id}]</Text>
                  {isPtAdmin && (
                    <Text style={[s.badge, { backgroundColor: '#eab308', color: '#0f172a' }]}>
                      👑 Tout Autorisé (Inviolable)
                    </Text>
                  )}
                  {pt.maxCsaAgeLimit && <Text style={[s.badge, { backgroundColor: '#f59e0b' }]}>🔞 -{pt.maxCsaAgeLimit}</Text>}
                  {pt.canWatchIptv && <Text style={[s.badge, { backgroundColor: '#0284c7' }]}>📺 TV</Text>}
                  {pt.canDownload && <Text style={[s.badge, { backgroundColor: '#059669' }]}>📥 DL</Text>}
                </View>
                {pt.description && <Text style={s.typeDesc}>{pt.description}</Text>}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {(pt.allowedFolders || []).map((f: string) => (
                    <Text key={f} style={[s.tagMini, { borderColor: '#10b981', color: '#34d399' }]}>📁✓ {f}</Text>
                  ))}
                  {(pt.allowedTags || []).map((t: string) => (
                    <Text key={t} style={[s.tagMini, { borderColor: '#10b981', color: '#34d399' }]}>✓ {t}</Text>
                  ))}
                  {(pt.blockedFolders || []).map((f: string) => (
                    <Text key={f} style={[s.tagMini, { borderColor: '#ef4444', color: '#f87171' }]}>📁✕ {f}</Text>
                  ))}
                  {(pt.blockedTags || []).map((t: string) => (
                    <Text key={t} style={[s.tagMini, { borderColor: '#ef4444', color: '#f87171' }]}>✕ {t}</Text>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Pressable focusable={true} style={[s.btnSmall, { backgroundColor: '#4f46e5' }]} onPress={() => handleEdit(pt)}>
                  <Text style={s.btnText}>✏️ Modifier</Text>
                </Pressable>
                {pt.id !== 'ADMINISTRATEUR' && pt.id !== 'MEMBRE' && (
                  <Pressable focusable={true} style={[s.btnSmall, { backgroundColor: '#ef4444' }]} onPress={() => setTypeToDelete(pt)}>
                    <Text style={s.btnText}>🗑️</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Éditeur de Pack de Profil */}
      <View style={s.editorBox}>
        <Text style={[s.title, { fontSize: 16 }]}>
          {editingId ? `✏️ Modifier le Pack "${label}"` : '+ Créer un Nouveau Type de Profil / Pack'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <TextInput
            style={[s.input, { flex: 1, minWidth: 140 }]}
            placeholder="Identifiant code (ex: ENFANT, SAFEZONE, MARVEL)"
            placeholderTextColor="#64748b"
            value={id}
            editable={!editingId}
            onChangeText={(t) => setId(t.toUpperCase())}
          />
          <TextInput
            style={[s.input, { flex: 1, minWidth: 140 }]}
            placeholder="Nom affiché (ex: Pack Jeunesse, Safezone)"
            placeholderTextColor="#64748b"
            value={label}
            onChangeText={setLabel}
          />
        </View>
        <TextInput
          style={s.input}
          placeholder="Description du pack et des règles d’accès..."
          placeholderTextColor="#64748b"
          value={desc}
          onChangeText={setDesc}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <View style={s.switchItem}>
            <Text style={s.switchLabel}>👑 Droits Admin {isEditingAdmin ? '(Inviolable)' : ''}</Text>
            <Switch
              value={isEditingAdmin ? true : isAdmin}
              disabled={isEditingAdmin}
              onValueChange={setIsAdmin}
            />
          </View>
          <View style={s.switchItem}>
            <Text style={s.switchLabel}>📺 Accès TV Live {isEditingAdmin ? '(Obligatoire)' : ''}</Text>
            <Switch
              value={isEditingAdmin ? true : canWatchIptv}
              disabled={isEditingAdmin}
              onValueChange={setCanWatchIptv}
            />
          </View>
          <View style={s.switchItem}>
            <Text style={s.switchLabel}>📥 Téléchargements {isEditingAdmin ? '(Obligatoire)' : ''}</Text>
            <Switch
              value={isEditingAdmin ? true : canDownload}
              disabled={isEditingAdmin}
              onValueChange={setCanDownload}
            />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            {isEditingAdmin ? (
              <TextInput
                style={[s.input, { opacity: 0.6 }]}
                value=""
                editable={false}
                placeholder="Illimité (Tout autorisé)"
                placeholderTextColor="#fef08a"
              />
            ) : (
              <TextInput
                style={s.input}
                placeholder="Limite Âge CSA (ex: 10, 12, 16)"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={csaAge}
                onChangeText={setCsaAge}
              />
            )}
          </View>
        </View>

        {/* Filtrage ABAC par tags et dossiers déporté dans ce pack */}
        {isEditingAdmin ? (
          <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', borderWidth: 1, borderColor: '#eab308', borderRadius: 8, padding: 12, marginVertical: 6 }}>
            <Text style={{ color: '#fef08a', fontWeight: '800', fontSize: 13, marginBottom: 2 }}>
              👑 Droits Totaux Obligatoires
            </Text>
            <Text style={{ color: '#fef9c3', fontSize: 12, lineHeight: 18 }}>
              Le type de compte Administrateur a tous les accès, tags, dossiers et flux TV obligatoirement et intégralement autorisés sans aucune restriction possible.
            </Text>
          </View>
        ) : (
          <AdminUserTagManager
            allowedTags={allowedTags}
            blockedTags={blockedTags}
            allowedFolders={allowedFolders}
            blockedFolders={blockedFolders}
            onChangeAllowedTags={setAllowedTags}
            onChangeBlockedTags={setBlockedTags}
            onChangeAllowedFolders={setAllowedFolders}
            onChangeBlockedFolders={setBlockedFolders}
          />
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {editingId && (
            <Pressable focusable={true} style={[s.btn, { backgroundColor: '#475569', flex: 1 }]} onPress={resetForm}>
              <Text style={s.btnText}>Annuler</Text>
            </Pressable>
          )}
          <Pressable focusable={true} style={[s.btn, { backgroundColor: '#6366f1', flex: 2 }]} onPress={handleSave} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{editingId ? '💾 Mettre à jour le pack' : '+ Enregistrer le type de profil'}</Text>}
          </Pressable>
        </View>
        {msg ? <Text style={s.status}>{msg}</Text> : null}
      </View>

      <ConfirmModal
        visible={!!typeToDelete}
        title="Supprimer le type de profil"
        message={`Confirmez-vous la suppression du type de profil "${typeToDelete?.label}" ? Les utilisateurs liés repasseront sur le profil standard.`}
        confirmText="Supprimer"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setTypeToDelete(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#1e293b', borderRadius: Radius.lg || 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  title: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  sub: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#334155', gap: 10 },
  typeName: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  typeCode: { color: '#64748b', fontSize: 12 },
  typeDesc: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  badge: { color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagMini: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  editorBox: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155', gap: 10 },
  input: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, color: '#f8fafc', fontSize: 13 },
  switchItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  btn: { padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  status: { color: '#38bdf8', fontSize: 12, textAlign: 'center', marginTop: 4 },
});
