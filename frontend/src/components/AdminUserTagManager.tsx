import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Radius } from '@/constants/theme';
import { AdminPhysicalFolderSelector } from './AdminPhysicalFolderSelector';

interface Props {
  allowedTags: string[];
  blockedTags: string[];
  allowedFolders?: string[];
  blockedFolders: string[];
  onChangeAllowedTags: (tags: string[]) => void;
  onChangeBlockedTags: (tags: string[]) => void;
  onChangeAllowedFolders?: (folders: string[]) => void;
  onChangeBlockedFolders: (folders: string[]) => void;
}

export function AdminUserTagManager({
  allowedTags = [],
  blockedTags = [],
  allowedFolders = [],
  blockedFolders = [],
  onChangeAllowedTags,
  onChangeBlockedTags,
  onChangeAllowedFolders,
  onChangeBlockedFolders,
}: Props) {
  const [tagInput, setTagInput] = useState('');
  const [activeSection, setActiveSection] = useState<'FOLDERS' | 'TAGS'>('FOLDERS');

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

  return (
    <View style={s.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabHeader} style={s.tabScroll}>
        <Pressable
          focusable={true}
          style={[s.tabPill, activeSection === 'FOLDERS' && s.tabPillActive]}
          onPress={() => setActiveSection('FOLDERS')}
        >
          <Text style={[s.tabPillTxt, activeSection === 'FOLDERS' && s.tabPillTxtActive]}>
            📁 Dossiers Physiques ({allowedFolders.length + blockedFolders.length} règles)
          </Text>
        </Pressable>
        <Pressable
          focusable={true}
          style={[s.tabPill, activeSection === 'TAGS' && s.tabPillActive]}
          onPress={() => setActiveSection('TAGS')}
        >
          <Text style={[s.tabPillTxt, activeSection === 'TAGS' && s.tabPillTxtActive]}>
            🏷️ Tags & Genres ({allowedTags.length + blockedTags.length} règles)
          </Text>
        </Pressable>
      </ScrollView>

      {activeSection === 'FOLDERS' ? (
        <AdminPhysicalFolderSelector
          allowedFolders={allowedFolders}
          blockedFolders={blockedFolders}
          onChangeAllowedFolders={onChangeAllowedFolders || (() => {})}
          onChangeBlockedFolders={onChangeBlockedFolders}
        />
      ) : (
        <View style={s.tagsCard}>
          <Text style={s.sectionTitle}>🏷️ Sécurité ABAC : Filtrage par Tags & Genres</Text>

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
              {allowedTags.length === 0 ? (
                <Text style={s.emptyHint}>Aucun tag exclusif — tous les genres autorisés.</Text>
              ) : (
                allowedTags.map((tag) => (
                  <Pressable
                    key={tag}
                    focusable={true}
                    style={[s.chip, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }]}
                    onPress={() => onChangeAllowedTags(allowedTags.filter((t) => t !== tag))}
                  >
                    <Text style={[s.chipText, { color: '#34d399' }]}>{tag} ✕</Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>

          {/* Tags Bloqués (Blacklist) */}
          <View style={s.group}>
            <Text style={s.label}>Tags Strictement Interdits ({blockedTags.length})</Text>
            <View style={s.pillWrap}>
              {blockedTags.length === 0 ? (
                <Text style={s.emptyHint}>Aucun tag interdit.</Text>
              ) : (
                blockedTags.map((tag) => (
                  <Pressable
                    key={tag}
                    focusable={true}
                    style={[s.chip, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }]}
                    onPress={() => onChangeBlockedTags(blockedTags.filter((t) => t !== tag))}
                  >
                    <Text style={[s.chipText, { color: '#f87171' }]}>{tag} ✕</Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 10, paddingTop: 6, gap: 10 },
  tabScroll: {
    marginBottom: 4,
    ...(Platform.OS === 'web' ? ({
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    } as any) : {}),
  },
  tabHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 2 },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill || 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap', userSelect: 'none' } as any) : {}),
  },
  tabPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  tabPillTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  tabPillTxtActive: { color: '#c7d2fe', fontWeight: '800' },
  tagsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: Radius.lg || 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    gap: 8,
  },
  sectionTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#0f172a', color: '#f8fafc', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm || 6, fontSize: 12, borderWidth: 1, borderColor: '#334155' },
  btnPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm || 6, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  group: { gap: 4, marginTop: 4 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  subLabel: { color: '#64748b', fontSize: 10, fontWeight: '400' },
  emptyHint: { color: '#64748b', fontSize: 11, fontStyle: 'italic', paddingVertical: 2 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 20 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill || 12, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '600' },
});
