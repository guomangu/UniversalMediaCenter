import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { fetchPhysicalFolders, type PhysicalFolderItem } from '@/services/adminApi';
import { Radius } from '@/constants/theme';

interface Props {
  allowedFolders: string[];
  blockedFolders: string[];
  onChangeAllowedFolders: (folders: string[]) => void;
  onChangeBlockedFolders: (folders: string[]) => void;
}

export function AdminPhysicalFolderSelector({
  allowedFolders = [],
  blockedFolders = [],
  onChangeAllowedFolders,
  onChangeBlockedFolders,
}: Props) {
  const [folders, setFolders] = useState<PhysicalFolderItem[]>([]);
  const [roots, setRoots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const loadFolders = async () => {
    setLoading(true);
    const res = await fetchPhysicalFolders();
    if (res.success) {
      setFolders(res.folders || []);
      setRoots(res.roots || []);
      // Déplier par défaut les racines et le premier niveau
      const initialExpanded = new Set<string>();
      (res.folders || []).forEach((f) => {
        if (f.depth <= 2) initialExpanded.add(f.path);
      });
      setExpandedPaths(initialExpanded);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const toggleExpand = (path: string) => {
    const next = new Set(expandedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedPaths(next);
  };

  const expandAll = () => {
    setExpandedPaths(new Set(folders.map((f) => f.path)));
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  // Normalisation pour comparaison
  const norm = (p: string) => (p || '').trim().toLowerCase().replace(/\\/g, '/');

  const isAllowed = (folderPath: string) => {
    const target = norm(folderPath);
    return allowedFolders.some((f) => {
      const c = norm(f);
      return target === c || target.endsWith(`/${c}`) || target.includes(`/${c}/`);
    });
  };

  const isBlocked = (folderPath: string) => {
    const target = norm(folderPath);
    return blockedFolders.some((f) => {
      const c = norm(f);
      return target === c || target.endsWith(`/${c}`) || target.includes(`/${c}/`);
    });
  };

  const toggleAllowFolder = (folderPath: string) => {
    const clean = folderPath.trim();
    if (!clean) return;
    if (isAllowed(clean)) {
      onChangeAllowedFolders(allowedFolders.filter((f) => norm(f) !== norm(clean)));
    } else {
      // Si on autorise exclusivement, on retire du blocage si présent
      onChangeBlockedFolders(blockedFolders.filter((f) => norm(f) !== norm(clean)));
      onChangeAllowedFolders([...allowedFolders, clean]);
    }
  };

  const toggleBlockFolder = (folderPath: string) => {
    const clean = folderPath.trim();
    if (!clean) return;
    if (isBlocked(clean)) {
      onChangeBlockedFolders(blockedFolders.filter((f) => norm(f) !== norm(clean)));
    } else {
      // Si on bloque, on retire de l'autorisation si présent
      onChangeAllowedFolders(allowedFolders.filter((f) => norm(f) !== norm(clean)));
      onChangeBlockedFolders([...blockedFolders, clean]);
    }
  };

  const resetFolderStatus = (folderPath: string) => {
    const target = norm(folderPath);
    onChangeAllowedFolders(allowedFolders.filter((f) => norm(f) !== target));
    onChangeBlockedFolders(blockedFolders.filter((f) => norm(f) !== target));
  };

  const addManual = (allow: boolean) => {
    const clean = manualInput.trim();
    if (!clean) return;
    if (allow) {
      if (!allowedFolders.includes(clean)) onChangeAllowedFolders([...allowedFolders, clean]);
    } else {
      if (!blockedFolders.includes(clean)) onChangeBlockedFolders([...blockedFolders, clean]);
    }
    setManualInput('');
  };

  // Filtrage par recherche
  const filteredFolders = useMemo(() => {
    if (!search.trim()) return folders;
    const q = search.trim().toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  }, [folders, search]);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>📁 Visualisation & Sélection des Dossiers Physiques</Text>
          <Text style={s.sub}>
            Gérez précisément les répertoires physiques autorisés exclusivement (Whitelist) ou interdits (Blacklist).
          </Text>
        </View>
        <Pressable focusable={true} style={s.refreshBtn} onPress={loadFolders} disabled={loading}>
          <Text style={s.refreshTxt}>{loading ? '⏳' : '🔄 Actualiser'}</Text>
        </Pressable>
      </View>

      {/* Résumé des règles actives */}
      <View style={s.summaryBox}>
        <View style={s.ruleSection}>
          <Text style={s.whitelistLabel}>
            🟢 Autorisés Exclusivement (Whitelist : {allowedFolders.length})
            <Text style={s.hint}> {allowedFolders.length === 0 ? '(Aucun = Tout autorisé)' : '(Seuls ces dossiers sont accessibles)'}</Text>
          </Text>
          <View style={s.chipsRow}>
            {allowedFolders.length === 0 ? (
              <Text style={s.emptyHint}>Aucune restriction exclusive — l’ensemble de la médiathèque est visible.</Text>
            ) : (
              allowedFolders.map((f) => (
                <Pressable key={f} focusable={true} style={s.chipAllowed} onPress={() => resetFolderStatus(f)}>
                  <Text style={s.chipAllowedTxt}>✅ {f} ✕</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <View style={s.ruleSection}>
          <Text style={s.blacklistLabel}>
            🔴 Strictement Interdits (Blacklist : {blockedFolders.length})
          </Text>
          <View style={s.chipsRow}>
            {blockedFolders.length === 0 ? (
              <Text style={s.emptyHint}>Aucun dossier interdit.</Text>
            ) : (
              blockedFolders.map((f) => (
                <Pressable key={f} focusable={true} style={s.chipBlocked} onPress={() => resetFolderStatus(f)}>
                  <Text style={s.chipBlockedTxt}>🚫 {f} ✕</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </View>

      {/* Barre d'outils et recherche */}
      <View style={s.toolbar}>
        <TextInput
          style={s.searchInput}
          placeholder="🔍 Filtrer les dossiers physiques (ex: Films, Animes, Bleach, Horreur)..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
        <View style={s.btnGroup}>
          <Pressable focusable={true} style={s.toolBtn} onPress={expandAll}>
            <Text style={s.toolBtnTxt}>▼ Déplier</Text>
          </Pressable>
          <Pressable focusable={true} style={s.toolBtn} onPress={collapseAll}>
            <Text style={s.toolBtnTxt}>▲ Replier</Text>
          </Pressable>
        </View>
      </View>

      {/* Arborescence interactive des dossiers */}
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
      ) : (
        <ScrollView style={s.treeScroll} nestedScrollEnabled={true}>
          {filteredFolders.length === 0 ? (
            <Text style={s.emptyHint}>Aucun dossier ne correspond à votre filtre.</Text>
          ) : (
            filteredFolders.map((item) => {
              const allowed = isAllowed(item.path);
              const blocked = isBlocked(item.path);
              const isExpanded = expandedPaths.has(item.path);
              const hasChildren = item.subfolderCount > 0;
              const indent = Math.min((item.depth - 1) * 16, 64);

              return (
                <View
                  key={item.path}
                  style={[
                    s.folderRow,
                    { paddingLeft: 12 + indent },
                    allowed && s.rowAllowed,
                    blocked && s.rowBlocked,
                  ]}
                >
                  <View style={s.folderInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {hasChildren ? (
                        <Pressable focusable={true} onPress={() => toggleExpand(item.path)} style={s.expandIcon}>
                          <Text style={s.expandIconTxt}>{isExpanded ? '▼' : '▶'}</Text>
                        </Pressable>
                      ) : (
                        <Text style={s.expandIconTxt}>•</Text>
                      )}

                      <Text style={s.folderIcon}>📁</Text>
                      <Text style={s.folderName}>{item.name}</Text>

                      {item.mediaCount > 0 && (
                        <View style={s.mediaBadge}>
                          <Text style={s.mediaBadgeTxt}>{item.mediaCount} média{item.mediaCount > 1 ? 's' : ''}</Text>
                        </View>
                      )}

                      {allowed && (
                        <View style={s.statusAllowedPill}>
                          <Text style={s.statusAllowedPillTxt}>✅ AUTORISÉ</Text>
                        </View>
                      )}

                      {blocked && (
                        <View style={s.statusBlockedPill}>
                          <Text style={s.statusBlockedPillTxt}>🚫 INTERDIT</Text>
                        </View>
                      )}
                    </View>

                    <Text style={s.folderPath} numberOfLines={1}>{item.relativePath || item.path}</Text>
                  </View>

                  {/* Boutons d'action pour le dossier */}
                  <View style={s.rowActions}>
                    <Pressable
                      focusable={true}
                      style={[s.actionBtn, allowed ? s.btnActiveAllowed : s.btnAllow]}
                      onPress={() => toggleAllowFolder(item.path)}
                    >
                      <Text style={s.actionBtnTxt}>{allowed ? '✓ Autorisé' : '+ Autoriser'}</Text>
                    </Pressable>

                    <Pressable
                      focusable={true}
                      style={[s.actionBtn, blocked ? s.btnActiveBlocked : s.btnBlock]}
                      onPress={() => toggleBlockFolder(item.path)}
                    >
                      <Text style={s.actionBtnTxt}>{blocked ? '✕ Interdit' : '- Interdire'}</Text>
                    </Pressable>

                    {(allowed || blocked) && (
                      <Pressable focusable={true} style={s.btnReset} onPress={() => resetFolderStatus(item.path)}>
                        <Text style={s.btnResetTxt}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Ajout manuel d'un chemin ou motif personnalisé */}
      <View style={s.manualBox}>
        <Text style={s.manualTitle}>Saisie manuelle directe d'un chemin ou d'un filtre personnalisé :</Text>
        <View style={s.manualRow}>
          <TextInput
            style={s.manualInput}
            placeholder="Ex: /Films/Adultes, Bleach, Animes..."
            placeholderTextColor="#64748b"
            value={manualInput}
            onChangeText={setManualInput}
          />
          <Pressable focusable={true} style={[s.manualBtn, { backgroundColor: '#10b981' }]} onPress={() => addManual(true)}>
            <Text style={s.manualBtnTxt}>+ Autoriser</Text>
          </Pressable>
          <Pressable focusable={true} style={[s.manualBtn, { backgroundColor: '#ef4444' }]} onPress={() => addManual(false)}>
            <Text style={s.manualBtnTxt}>- Bloquer</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: Radius.lg || 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    gap: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '800', color: '#f8fafc', marginBottom: 2 },
  sub: { fontSize: 12, color: '#94a3b8', lineHeight: 17 },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm || 6, backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  refreshTxt: { color: '#818cf8', fontSize: 11, fontWeight: '700' },
  summaryBox: { backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: Radius.md || 10, padding: 12, gap: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  ruleSection: { gap: 4 },
  whitelistLabel: { fontSize: 12, fontWeight: '700', color: '#34d399' },
  blacklistLabel: { fontSize: 12, fontWeight: '700', color: '#f87171' },
  hint: { fontSize: 11, fontWeight: '400', color: '#94a3b8' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 22 },
  emptyHint: { color: '#64748b', fontSize: 11, fontStyle: 'italic', paddingVertical: 2 },
  chipAllowed: { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 1, borderColor: '#10b981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill || 12 },
  chipAllowedTxt: { color: '#6ee7b7', fontSize: 11, fontWeight: '700' },
  chipBlocked: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill || 12 },
  chipBlockedTxt: { color: '#fca5a5', fontSize: 11, fontWeight: '700' },
  toolbar: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 200, backgroundColor: '#0f172a', borderRadius: Radius.sm || 6, paddingHorizontal: 12, paddingVertical: 8, color: '#f8fafc', fontSize: 12, borderWidth: 1, borderColor: '#334155' },
  btnGroup: { flexDirection: 'row', gap: 6 },
  toolBtn: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.sm || 6 },
  toolBtnTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  treeScroll: { maxHeight: 360, backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: Radius.md || 10, borderWidth: 1, borderColor: '#334155', paddingVertical: 4 },
  folderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.04)', gap: 8 },
  rowAllowed: { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
  rowBlocked: { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  folderInfo: { flex: 1, minWidth: 160 },
  expandIcon: { width: 16, alignItems: 'center' },
  expandIconTxt: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  folderIcon: { fontSize: 13 },
  folderName: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  mediaBadge: { backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill || 10 },
  mediaBadgeTxt: { color: '#c7d2fe', fontSize: 10, fontWeight: '700' },
  statusAllowedPill: { backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  statusAllowedPillTxt: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  statusBlockedPill: { backgroundColor: '#dc2626', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  statusBlockedPillTxt: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  folderPath: { color: '#64748b', fontSize: 10, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnAllow: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.4)' },
  btnActiveAllowed: { backgroundColor: '#10b981' },
  btnBlock: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
  btnActiveBlocked: { backgroundColor: '#ef4444' },
  actionBtnTxt: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  btnReset: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  btnResetTxt: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  manualBox: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)', gap: 6 },
  manualTitle: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 6 },
  manualInput: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: Radius.sm || 6, paddingHorizontal: 10, paddingVertical: 6, color: '#f8fafc', fontSize: 12 },
  manualBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm || 6, justifyContent: 'center' },
  manualBtnTxt: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
