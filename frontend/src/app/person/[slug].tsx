import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPerson, resolveImageUrl } from '@/services/api';
import { MediaCard } from '@/components/MediaCard';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';
import { goBackOrFallback } from '@/utils/navigation';

const ROLE_LABELS: Record<string, string> = {
  actor: 'Acteur / Actrice',
  director: 'Réalisation',
  writer: 'Scénario',
  producer: 'Production',
  composer: 'Musique',
};

export default function PersonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string; name?: string; role?: string }>();
  const slug = String(params.slug || '').trim();
  const headerPaddingTop = useHeaderHeight(false);

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>('ALL');

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPerson(slug)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const displayName = data?.person?.name || params.name || slug.replace(/-/g, ' ');
  const roles: string[] = data?.person?.roles || (params.role ? [String(params.role)] : []);
  const roleCounts: Record<string, number> = data?.roleCounts || {};

  const medias: any[] = useMemo(() => {
    const list = Array.isArray(data?.medias) ? data.medias : [];
    if (activeRole === 'ALL') return list;
    return list.filter((media: any) => (media.roles || []).includes(activeRole));
  }, [data, activeRole]);

  const avatarUrl = resolveImageUrl(data?.person?.thumbnailUrl || null);

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          focusable={true}
          accessibilityRole="button"
          onPress={() => goBackOrFallback(router, '/explore')}
          style={styles.backBtn}
        >
          <Text style={styles.backTxt}>← Retour</Text>
        </Pressable>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#818cf8" />
            <Text style={styles.loadingTxt}>Chargement de la filmographie…</Text>
          </View>
        ) : !data ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyTitle}>Personne introuvable</Text>
            <Text style={styles.emptyText}>
              Aucune œuvre locale n'est associée à « {displayName} ». La fiche est créée automatiquement
              dès qu'un média indexé mentionne cette personne.
            </Text>
            <Pressable focusable={true} onPress={() => router.push('/explore' as any)} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>Explorer le catalogue</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarInitials}>{displayName.slice(0, 2).toUpperCase()}</Text>
                )}
              </View>

              <View style={styles.heroMeta}>
                <Text style={styles.name}>{displayName}</Text>
                <View style={styles.roleBadgeRow}>
                  {roles.map((role) => (
                    <View key={role} style={styles.roleBadge}>
                      <Text style={styles.roleBadgeTxt}>{ROLE_LABELS[role] || role}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.countTxt}>
                  🎬 {data.person?.totalMedias ?? medias.length} œuvre{(data.person?.totalMedias ?? medias.length) > 1 ? 's' : ''} dans votre médiathèque
                </Text>
              </View>
            </View>

            {roles.length > 1 && (
              <View style={styles.filterRow}>
                <Pressable
                  focusable={true}
                  onPress={() => setActiveRole('ALL')}
                  style={[styles.filterPill, activeRole === 'ALL' && styles.filterPillActive]}
                >
                  <Text style={[styles.filterTxt, activeRole === 'ALL' && styles.filterTxtActive]}>
                    Tout ({data.person?.totalMedias ?? medias.length})
                  </Text>
                </Pressable>
                {roles.map((role) => (
                  <Pressable
                    key={role}
                    focusable={true}
                    onPress={() => setActiveRole(role)}
                    style={[styles.filterPill, activeRole === role && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterTxt, activeRole === role && styles.filterTxtActive]}>
                      {ROLE_LABELS[role] || role} ({roleCounts[role] || 0})
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Filmographie locale ({medias.length})
            </Text>

            {medias.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Aucune œuvre ne correspond à ce rôle.</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {medias.map((media: any) => (
                  <View key={media.id} style={styles.gridItem}>
                    <MediaCard item={media} styleVariant="POSTER" />
                    {media.characters && media.characters.length > 0 ? (
                      <Text style={styles.characterTxt} numberOfLines={1}>
                        {media.characters.join(', ')}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    marginBottom: Spacing.three,
  },
  backTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  loadingWrap: { paddingVertical: Spacing.six * 2, alignItems: 'center', gap: 12 },
  loadingTxt: { color: '#94a3b8', fontSize: 14 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    padding: Spacing.four,
    marginBottom: Spacing.four,
    flexWrap: 'wrap',
  },
  avatarWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: 'hidden',
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  avatar: { width: '100%', height: '100%' },
  avatarInitials: { color: '#e0e7ff', fontSize: 30, fontWeight: '800' },
  heroMeta: { flex: 1, minWidth: 220, gap: 8 },
  name: { color: '#f8fafc', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  roleBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  roleBadgeTxt: { color: '#c7d2fe', fontSize: 11.5, fontWeight: '700' },
  countTxt: { color: '#94a3b8', fontSize: 13 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.three },
  filterPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  filterPillActive: { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderColor: '#6366f1' },
  filterTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  filterTxtActive: { color: '#c7d2fe', fontWeight: '800' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gridItem: { marginBottom: Spacing.two },
  characterTxt: { color: '#8e9ab0', fontSize: 10.5, marginTop: 3, maxWidth: 140 },
  emptyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    padding: Spacing.five,
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.three,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 520 },
  primaryBtn: { marginTop: 6, backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.md },
  primaryBtnTxt: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});
