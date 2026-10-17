import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import {
  fetchAdminRails,
  reorderAdminRails,
  updateAdminRail,
  fetchAdminTags,
  updateAdminTag,
} from '@/services/adminApi';
import { Radius } from '@/constants/theme';

export function AdminLayoutTab() {
  const [rails, setRails] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'RAILS' | 'TAGS'>('RAILS');

  const loadData = async () => {
    setLoading(true);
    const [railsData, tagsData] = await Promise.all([
      fetchAdminRails(),
      fetchAdminTags(),
    ]);
    setRails(railsData);
    setTags(tagsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const moveRail = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rails.length) return;

    const newRails = [...rails];
    const temp = newRails[index];
    newRails[index] = newRails[targetIndex];
    newRails[targetIndex] = temp;

    const orders = newRails.map((r, i) => ({ id: r.id, sortOrder: (i + 1) * 10 }));
    setRails(newRails);
    setActionLoading(true);
    await reorderAdminRails(orders);
    setActionLoading(false);
    setMsg('✅ Ordre des rails mis à jour');
  };

  const toggleRail = async (rail: any) => {
    setActionLoading(true);
    await updateAdminRail(rail.id, { isActive: !rail.isActive });
    setActionLoading(false);
    setRails(rails.map((r) => (r.id === rail.id ? { ...r, isActive: !r.isActive } : r)));
    setMsg(`✅ Rail "${rail.title}" ${!rail.isActive ? 'activé' : 'désactivé'}`);
  };

  const cycleCardStyle = async (rail: any) => {
    const styles = ['POSTER', 'BACKDROP', 'BANNER', 'CIRCLE', 'LIST'];
    const currIdx = styles.indexOf(rail.cardStyle || 'POSTER');
    const nextStyle = styles[(currIdx + 1) % styles.length];

    setActionLoading(true);
    await updateAdminRail(rail.id, { cardStyle: nextStyle });
    setActionLoading(false);
    setRails(rails.map((r) => (r.id === rail.id ? { ...r, cardStyle: nextStyle } : r)));
  };

  const cycleTagZone = async (tag: any) => {
    const zones = ['HERO_PRIMARY', 'BELOW_PLAYER', 'DETAILS_MODAL', 'SEARCH_FILTER', 'NONE'];
    const currIdx = zones.indexOf(tag.uiZone || 'NONE');
    const nextZone = zones[(currIdx + 1) % zones.length];

    setActionLoading(true);
    await updateAdminTag(tag.id, { uiZone: nextZone });
    setActionLoading(false);
    setTags(tags.map((t) => (t.id === tag.id ? { ...t, uiZone: nextZone } : t)));
    setMsg(`✅ Zone d'affichage du tag "${tag.displayName || tag.code}" mise à jour : ${nextZone}`);
  };

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🎨 Server-Driven UI : Rails d’Accueil & Tags</Text>
          <Text style={s.sub}>
            Personnalisez l’agencement de l’accueil en direct : réordonnez les rails, basculez les styles de cartes et organisez les zones de tags.
          </Text>
        </View>
        <Pressable focusable={true} style={s.refreshBtn} onPress={loadData} disabled={loading}>
          <Text style={s.refreshTxt}>{loading ? '⏳' : '🔄 Actualiser'}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabSwitch} style={s.tabScroll}>
        <Pressable
          focusable={true}
          style={[s.tabPill, activeSubTab === 'RAILS' && s.tabPillActive]}
          onPress={() => setActiveSubTab('RAILS')}
        >
          <Text style={[s.tabPillTxt, activeSubTab === 'RAILS' && s.tabPillTxtActive]}>
            🛤️ Rails d'Accueil ({rails.length})
          </Text>
        </Pressable>
        <Pressable
          focusable={true}
          style={[s.tabPill, activeSubTab === 'TAGS' && s.tabPillActive]}
          onPress={() => setActiveSubTab('TAGS')}
        >
          <Text style={[s.tabPillTxt, activeSubTab === 'TAGS' && s.tabPillTxtActive]}>
            🏷️ Hiérarchie des Tags & Zones ({tags.length})
          </Text>
        </Pressable>
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 30 }} />
      ) : activeSubTab === 'RAILS' ? (
        <View style={{ gap: 8 }}>
          {rails.map((rail, idx) => (
            <View key={rail.id} style={s.itemRow}>
              <View style={s.orderControls}>
                <Pressable
                  focusable={idx > 0}
                  disabled={idx === 0 || actionLoading}
                  style={[s.orderBtn, idx === 0 && { opacity: 0.3 }]}
                  onPress={() => moveRail(idx, 'UP')}
                >
                  <Text style={s.orderBtnTxt}>▲</Text>
                </Pressable>
                <Pressable
                  focusable={idx < rails.length - 1}
                  disabled={idx === rails.length - 1 || actionLoading}
                  style={[s.orderBtn, idx === rails.length - 1 && { opacity: 0.3 }]}
                  onPress={() => moveRail(idx, 'DOWN')}
                >
                  <Text style={s.orderBtnTxt}>▼</Text>
                </Pressable>
              </View>

              <View style={{ flex: 1, minWidth: 160 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.itemTitle}>{rail.title}</Text>
                  <View style={[s.statusBadge, { backgroundColor: rail.isActive ? '#065f46' : '#7f1d1d' }]}>
                    <Text style={s.statusBadgeTxt}>{rail.isActive ? 'Actif' : 'Masqué'}</Text>
                  </View>
                </View>
                <Text style={s.itemSub}>
                  Type : <Text style={{ color: '#cbd5e1' }}>{rail.railType}</Text> • Page : {rail.pageTarget}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Pressable focusable={true} style={s.actionPill} onPress={() => cycleCardStyle(rail)}>
                  <Text style={s.actionPillTxt}>🖼️ Format : {rail.cardStyle || 'POSTER'}</Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  style={[s.actionPill, { backgroundColor: rail.isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]}
                  onPress={() => toggleRail(rail)}
                >
                  <Text style={[s.actionPillTxt, { color: rail.isActive ? '#f87171' : '#34d399' }]}>
                    {rail.isActive ? 'Désactiver' : 'Activer'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {tags.map((tag) => (
            <View key={tag.id} style={s.itemRow}>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={s.itemTitle}>{tag.displayName || tag.code}</Text>
                <Text style={s.itemSub}>Code : [{tag.code}] • Zone actuelle : {tag.uiZone || 'NONE'}</Text>
              </View>

              <Pressable focusable={true} style={s.actionPill} onPress={() => cycleTagZone(tag)}>
                <Text style={s.actionPillTxt}>📍 Zone : {tag.uiZone || 'NONE'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {msg ? <Text style={s.statusMsg}>{msg}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: Radius.lg || 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  sub: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm || 6, backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  refreshTxt: { color: '#818cf8', fontSize: 11, fontWeight: '700' },
  tabScroll: {
    marginBottom: 16,
    ...(Platform.OS === 'web' ? ({
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    } as any) : {}),
  },
  tabSwitch: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 2 },
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
  tabPillActive: { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderColor: '#6366f1' },
  tabPillTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  tabPillTxtActive: { color: '#c7d2fe', fontWeight: '800' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
    flexWrap: 'wrap',
  },
  orderControls: { flexDirection: 'row', gap: 4 },
  orderBtn: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  orderBtnTxt: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  itemTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  itemSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  actionPill: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill || 12 },
  actionPillTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  statusMsg: { color: '#38bdf8', fontSize: 12, fontWeight: '600', marginTop: 12, textAlign: 'center' },
});
