import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Radius } from '@/constants/theme';

interface Props {
  allowedTags: string[];
  blockedTags: string[];
  blockedFolders: string[];
  onChangeAllowedTags: (tags: string[]) => void;
  onChangeBlockedTags: (tags: string[]) => void;
  onChangeBlockedFolders: (folders: string[]) => void;
}

export function AdminUserTagManager({
  allowedTags = [],
  blockedTags = [],
  blockedFolders = [],
  onChangeAllowedTags,
  onChangeBlockedTags,
  onChangeBlockedFolders,
}: Props) {
  const [tagInput, setTagInput] = useState('');
  const [folderInput, setFolderInput] = useState('');

  const addTag = (isAllowed: boolean) => {
    const clean = tagInput.trim();
    if (!clean) return;
    if (isAllowed) {
      if (!allowedTags.includes(clean)) onChangeAllowedTags([...allowedTags, clean]);
    } else {
      if (!blockedTags.includes(clean)) onChangeBlockedTags([...blockedTags, clean]);
    }
    setTagInput('');
  };

  const addFolder = () => {
    const clean = folderInput.trim();
    if (!clean) return;
    if (!blockedFolders.includes(clean)) onChangeBlockedFolders([...blockedFolders, clean]);
    setFolderInput('');
  };

  return (
    <View style={s.container}>
      <Text style={s.sectionTitle}>🏷️ Sécurité ABAC : Filtrage par Tags & Dossiers</Text>

      {/* Bar de saisie et recherche de tag */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Rechercher ou saisir un tag (ex: Horreur, Anime, +18)..."
          placeholderTextColor="#64748b"
          value={tagInput}
          onChangeText={setTagInput}
        />
        <Pressable
          focusable={true}
          style={[s.btnPill, { backgroundColor: '#10b981' }]}
          onPress={() => addTag(true)}
        >
          <Text style={s.btnText}>+ Autoriser</Text>
        </Pressable>
        <Pressable
          focusable={true}
          style={[s.btnPill, { backgroundColor: '#ef4444' }]}
          onPress={() => addTag(false)}
        >
          <Text style={s.btnText}>- Bloquer</Text>
        </Pressable>
      </View>

      {/* Tags Autorisés (Whitelist) */}
      <View style={s.group}>
        <Text style={s.label}>
          Tags Exclusivement Autorisés ({allowedTags.length}){' '}
          <Text style={s.subLabel}>{allowedTags.length === 0 ? '(Aucun = Tout autorisé sauf bloqués)' : '(Seuls ces tags sont visibles)'}</Text>
        </Text>
        <View style={s.pillWrap}>
          {allowedTags.map((tag) => (
            <Pressable
              key={tag}
              focusable={true}
              style={[s.chip, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }]}
              onPress={() => onChangeAllowedTags(allowedTags.filter((t) => t !== tag))}
            >
              <Text style={[s.chipText, { color: '#34d399' }]}>{tag} ✕</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Tags Bloqués (Blacklist) */}
      <View style={s.group}>
        <Text style={s.label}>Tags Strictement Interdits ({blockedTags.length})</Text>
        <View style={s.pillWrap}>
          {blockedTags.map((tag) => (
            <Pressable
              key={tag}
              focusable={true}
              style={[s.chip, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }]}
              onPress={() => onChangeBlockedTags(blockedTags.filter((t) => t !== tag))}
            >
              <Text style={[s.chipText, { color: '#f87171' }]}>{tag} ✕</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Dossiers Exclus */}
      <View style={s.group}>
        <Text style={s.label}>Dossiers Exclus de la Bibliothèque ({blockedFolders.length})</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Nom ou chemin de dossier à masquer (ex: /Films/Horreur, Animes)..."
            placeholderTextColor="#64748b"
            value={folderInput}
            onChangeText={setFolderInput}
          />
          <Pressable
            focusable={true}
            style={[s.btnPill, { backgroundColor: '#f59e0b' }]}
            onPress={addFolder}
          >
            <Text style={s.btnText}>+ Exclure Dossier</Text>
          </Pressable>
        </View>
        <View style={s.pillWrap}>
          {blockedFolders.map((folder) => (
            <Pressable
              key={folder}
              focusable={true}
              style={[s.chip, { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b' }]}
              onPress={() => onChangeBlockedFolders(blockedFolders.filter((f) => f !== folder))}
            >
              <Text style={[s.chipText, { color: '#fbbf24' }]}>📁 {folder} ✕</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.3)', gap: 8 },
  sectionTitle: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#0f172a', color: '#f8fafc', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm || 6, fontSize: 12, borderWidth: 1, borderColor: '#334155' },
  btnPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm || 6, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  group: { gap: 4, marginTop: 4 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  subLabel: { color: '#64748b', fontSize: 10, fontWeight: '400' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 20 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill || 12, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '600' },
});
