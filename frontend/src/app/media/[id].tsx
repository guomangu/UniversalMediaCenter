import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMediaDetail, resolveImageUrl } from '@/services/api';
import { checkFavorite, toggleFavorite } from '@/services/userApi';
import { fetchMediaReposts } from '@/services/repostApi';
import { MediaDetailResponse } from '@/services/types';
import { TagPill } from '@/components/TagPill';
import { ClickableTopicText } from '@/components/ClickableTopicText';
import { MediaChildrenRow } from '@/components/MediaChildrenRow';
import { MediaGenreSection } from '@/components/MediaGenreSection';
import { MediaRepostModal } from '@/components/MediaRepostModal';
import { CastModal } from '@/components/CastModal';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function MediaDetailScreen() {
  const { id, share } = useLocalSearchParams<{ id: string; share?: string }>();
  const router = useRouter();
  const [data, setData] = useState<MediaDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCast, setShowCast] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [reposts, setReposts] = useState<any[]>([]);

  const loadData = () => {
    if (!id) return;
    setLoading(true);
    fetchMediaDetail(id, share)
      .then((res) => {
        if (!res) {
          router.replace({
            pathname: '/login',
            params: {
              returnUrl: `/media/${id}${share ? `?share=${share}` : ''}`,
              error: 'Connexion requise pour accéder à cette œuvre ou lien expiré',
            },
          } as any);
        } else {
          setData(res);
        }
      })
      .finally(() => setLoading(false));

    checkFavorite(id).then(setIsFav);
    fetchMediaReposts(id).then(setReposts);
  };

  useEffect(() => {
    loadData();
  }, [id, share]);

  const handleToggleFav = async () => {
    if (!id) return;
    const nextState = !isFav;
    setIsFav(nextState);
    await toggleFavorite(id, nextState);
  };

  const { media, tags = { HERO_BADGE: [], PRIMARY_PILL: [], PERSON_CAROUSEL: [], TECHNICAL_DRAWER: [] }, children = [], relatedTags = [] } = data || ({} as any);

  // Séparation du casting (acteurs) et de l'équipe technique (réalisateurs, scénaristes, compositeurs, producteurs)
  const { actors, crewMembers, technicalSpecs } = useMemo(() => {
    const persons = tags.PERSON_CAROUSEL || [];
    const actorsList = persons.filter((p: any) => p.attr_code === 'actor');
    const crewList = persons.filter((p: any) => p.attr_code !== 'actor');
    const techList = (tags.TECHNICAL_DRAWER || []).filter(
      (t: any) => !t.attr_code.startsWith('custom_')
    );
    return { actors: actorsList, crewMembers: crewList, technicalSpecs: techList };
  }, [tags]);

  if (loading || !data) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: '#94a3b8' }}>Chargement du média...</Text>
      </View>
    );
  }

  const fanartUri = resolveImageUrl(media.fanartPath || media.posterPath);
  const playId = children.length > 0 ? children[0].id : media.id;
  const seasonTag = media.displayBadge || media.seasonEpisodeTag;

  const handlePlay = () => {
    router.push({
      pathname: `/player/${playId}`,
      params: share ? { share } : undefined,
    } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable focusable={true} onPress={() => router.push('/')} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Retour à l'accueil</Text>
        </Pressable>

        <View style={styles.heroBox}>
          {fanartUri ? <Image source={{ uri: fanartUri }} style={styles.backdrop} /> : null}
          <View style={styles.heroContent}>
            <View style={styles.zoneRow}>
              {seasonTag ? (
                <View style={styles.seasonTagPill}>
                  <Text style={styles.seasonTagTxt}>{seasonTag}</Text>
                </View>
              ) : null}
              {tags.HERO_BADGE?.map((b: any, i: number) => (
                <TagPill key={i} label={b.value_text} theme={b.color_theme || 'amber'} />
              ))}
            </View>

            <ClickableTopicText
              text={media.title}
              topicSlug={media.slug || media.id}
              topicTitle={media.title}
              style={styles.title}
            />

            {media.overview ? (
              <ClickableTopicText
                text={media.overview}
                topicSlug={media.slug || media.id}
                topicTitle={media.title}
                style={styles.overview}
              />
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              <Pressable focusable={true} onPress={handlePlay} style={styles.playBtn}>
                <Text style={styles.btnText}>▶ Regarder</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={handleToggleFav}
                style={[
                  styles.playBtn,
                  isFav ? { backgroundColor: '#dc2626' } : { backgroundColor: '#334155' },
                ]}
              >
                <Text style={styles.btnText}>{isFav ? '❤️ Favori' : '🤍 Ajouter aux favoris'}</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() => setShowRepostModal(true)}
                style={[styles.playBtn, { backgroundColor: '#0284c7' }]}
              >
                <Text style={styles.btnText}>🔄 Avis & Repost</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() => setShowCast(true)}
                style={[styles.playBtn, { backgroundColor: '#4338ca' }]}
              >
                <Text style={styles.btnText}>📡 Diffuser</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() =>
                  router.push({
                    pathname: '/forum/[topic]',
                    params: { topic: media.slug || media.id, title: media.title },
                  } as any)
                }
                style={[styles.playBtn, { backgroundColor: '#334155' }]}
              >
                <Text style={styles.btnText}>💬 Forum WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Épisodes & Saisons structurés avec onglets interactifs */}
        <MediaChildrenRow
          parentType={media.nodeType}
          parentPoster={media.posterPath}
          children={children}
        />

        {/* Équipes artistiques et créatives (Réalisateurs, Scénaristes, Compositeurs, Producteurs) */}
        {crewMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Réalisation & Création</Text>
            <View style={styles.zoneRow}>
              {crewMembers.map((c: any, i: number) => {
                const roleTheme =
                  c.attr_code === 'director'
                    ? 'amber'
                    : c.attr_code === 'writer'
                    ? 'emerald'
                    : c.attr_code === 'composer'
                    ? 'rose'
                    : 'indigo';
                return (
                  <TagPill
                    key={i}
                    label={c.value_text}
                    subtext={c.display_name}
                    theme={roleTheme}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Casting des Acteurs avec Photos de profil et Rôles */}
        {actors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Casting ({actors.length})</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actorsScroll}
            >
              {actors.map((actor: any, idx: number) => {
                const thumb = actor.metadata_json?.thumbUrl;
                return (
                  <View key={idx} style={styles.actorCard}>
                    <View style={styles.actorAvatarWrap}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.actorAvatar} />
                      ) : (
                        <View style={styles.actorAvatarPlaceholder}>
                          <Text style={{ fontSize: 24 }}>👤</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.actorName} numberOfLines={1}>
                      {actor.value_text}
                    </Text>
                    {actor.context_role ? (
                      <Text style={styles.actorRole} numberOfLines={2}>
                        {actor.context_role}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Caractéristiques Techniques & Pistes de Flux */}
        {technicalSpecs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Détails Techniques & Flux</Text>
            <View style={styles.zoneRow}>
              {technicalSpecs.map((t: any, i: number) => (
                <TagPill
                  key={i}
                  label={t.value_text}
                  subtext={t.display_name}
                  theme="slate"
                />
              ))}
            </View>
          </View>
        )}

        <MediaGenreSection relatedTags={relatedTags} fallbackTags={tags.PRIMARY_PILL} />

        {/* Section Avis & Reposts communautaires */}
        {reposts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Avis & Reposts de la Communauté ({reposts.length})</Text>
            <View style={{ gap: 10 }}>
              {reposts.map((r) => (
                <View key={r.id} style={styles.repostCard}>
                  <View style={styles.repostHeader}>
                    <Text style={styles.repostAuthor}>{r.author?.displayName || 'Membre'}</Text>
                    {r.rating ? <Text style={styles.repostRating}>{'★'.repeat(r.rating)}</Text> : null}
                  </View>
                  {r.comment ? <Text style={styles.repostComment}>{r.comment}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <MediaRepostModal
        visible={showRepostModal}
        mediaId={media.id}
        mediaTitle={media.title}
        onClose={() => setShowRepostModal(false)}
        onSuccess={() => fetchMediaReposts(media.id).then(setReposts)}
      />

      <CastModal
        visible={showCast}
        onClose={() => setShowCast(false)}
        currentMedia={{ id: String(playId), title: media.title, positionSeconds: 0 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingBottom: 60 },
  loading: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  backBtn: { padding: Spacing.three },
  backTxt: { color: '#818cf8', fontWeight: '700' },
  heroBox: { position: 'relative', minHeight: 340, justifyContent: 'flex-end', padding: Spacing.four },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  heroContent: { maxWidth: MaxContentWidth, gap: 10 },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  seasonTagPill: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  seasonTagTxt: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '900', color: '#f8fafc' },
  overview: { fontSize: 14, color: '#cbd5e1', lineHeight: 22, maxWidth: 800 },
  playBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: '#6366f1',
  },
  btnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  section: { padding: Spacing.four },
  secTitle: { fontSize: 18, fontWeight: '800', color: '#f8fafc', marginBottom: 12 },
  actorsScroll: { gap: 14, paddingVertical: 4 },
  actorCard: {
    width: 105,
    alignItems: 'center',
    gap: 4,
  },
  actorAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    marginBottom: 4,
  },
  actorAvatar: { width: '100%', height: '100%' },
  actorAvatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actorName: { color: '#f1f5f9', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  actorRole: { color: '#94a3b8', fontSize: 10, fontWeight: '500', textAlign: 'center', lineHeight: 13 },
  repostCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  repostHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  repostAuthor: { color: '#818cf8', fontWeight: '700', fontSize: 13 },
  repostRating: { color: '#fbbf24', fontSize: 14 },
  repostComment: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },
});
