import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMediaDetail, resolveImageUrl } from '@/services/api';
import { checkFavorite, toggleFavorite } from '@/services/userApi';
import { fetchMediaReposts } from '@/services/repostApi';
import { MediaDetailResponse } from '@/services/types';
import { getCachedData } from '@/services/pwaDataCache';
import { TagPill } from '@/components/TagPill';
import { ClickableTopicText } from '@/components/ClickableTopicText';
import { MediaChildrenRow } from '@/components/MediaChildrenRow';
import { MediaSagaRow } from '@/components/MediaSagaRow';
import { MediaStudioSection } from '@/components/MediaStudioSection';
import { MediaGenreSection } from '@/components/MediaGenreSection';
import { MediaRepostModal } from '@/components/MediaRepostModal';
import { MediaForumSection } from '@/components/MediaForumSection';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { CastModal } from '@/components/CastModal';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function MediaDetailScreen() {
  const { id, share } = useLocalSearchParams<{ id: string; share?: string }>();
  const router = useRouter();
  const headerPaddingTop = useHeaderHeight(false);
  const cacheKey = `media_detail_${id}${share ? `_${share}` : ""}`;
  const initialCached = id ? getCachedData<MediaDetailResponse>(cacheKey) : null;
  const [data, setData] = useState<MediaDetailResponse | null>(initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [showCast, setShowCast] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [reposts, setReposts] = useState<any[]>([]);

  const loadData = () => {
    if (!id) return;
    if (!data) setLoading(true);
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

  const {
    media,
    tags = { HERO_BADGE: [], PRIMARY_PILL: [], PERSON_CAROUSEL: [], TECHNICAL_DRAWER: [] },
    children = [],
    extras = [],
    parentSaga = null,
    studioMedias = [],
    relatedTags = [],
  } = data || ({} as any);

  // Extraction et classification exhaustive de toutes les métadonnées (Loi n°1 : Zéro perte de données)
  const {
    actors,
    directors,
    writers,
    producers,
    composers,
    studios,
    countries,
    technicalSpecs,
    ratings,
  } = useMemo(() => {
    const persons = (tags.PERSON_CAROUSEL || tags.PERSONS || []) as any[];
    const pills = (tags.PRIMARY_PILL || tags.PILLS || []) as any[];
    const tech = (tags.TECHNICAL_DRAWER || tags.ACCORDION || []) as any[];
    const heroes = (tags.HERO_BADGE || tags.HERO || []) as any[];

    const isCollection = media?.nodeType === 'COLLECTION';
    const actorsList = persons.filter((p: any) => p.attr_code === 'actor').slice(0, 50);
    const directorsList = persons.filter((p: any) => p.attr_code === 'director').slice(0, 20);
    const writersList = persons.filter((p: any) => p.attr_code === 'writer' || p.attr_code === 'credits').slice(0, 20);
    const producersList = persons.filter((p: any) => p.attr_code === 'producer').slice(0, 20);
    const composersList = persons.filter((p: any) => p.attr_code === 'composer' || p.attr_code === 'music').slice(0, 20);

    const studiosList = pills.filter((p: any) => p.attr_code === 'studio').slice(0, 15);
    const countriesList = pills.filter((p: any) => p.attr_code === 'country' || p.attr_code === 'location').slice(0, 15);

    // Spécifications techniques
    const techList = tech.filter(
      (t: any) =>
        !t.attr_code.startsWith('custom_') ||
        ['custom_aspectratio', 'custom_videocodec', 'custom_audiocodec'].includes(t.attr_code)
    );

    // Notes et Classifications
    const ratingList: { label: string; value: string; theme: string }[] = [];
    if (media?.communityRating) {
      ratingList.push({
        label: isCollection ? 'Note moyenne saga' : 'Note spectateurs',
        value: `${Number(media.communityRating).toFixed(1)} / 10`,
        theme: 'amber',
      });
    }
    const cert = heroes.find((h: any) => h.attr_code === 'certification');
    if (cert) {
      ratingList.push({
        label: 'Classification',
        value: cert.value_text || cert.value,
        theme: 'orange',
      });
    }

    return {
      actors: actorsList,
      directors: directorsList,
      writers: writersList,
      producers: producersList,
      composers: composersList,
      studios: studiosList,
      countries: countriesList,
      technicalSpecs: techList,
      ratings: ratingList,
    };
  }, [tags, media]);

  if (loading || !data) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: '#8a95a5' }}>Chargement du média...</Text>
      </View>
    );
  }

  const fanartUri = resolveImageUrl(media.fanartPath || media.posterPath);
  const playId = media.resumeEpisodeId || (children.length > 0 ? children[0].id : media.id);
  const seasonTag = media.displayBadge || media.seasonEpisodeTag;

  // Libellé de reprise automatique de lecture
  const playLabel =
    media.resumePositionSeconds && media.resumePositionSeconds > 0
      ? `Reprendre (${Math.floor(media.resumePositionSeconds / 60)} min)`
      : `Regarder`;

  const handlePlay = () => {
    router.push({
      pathname: `/player/${playId}`,
      params: share ? { share, title: media.title } : { title: media.title },
    } as any);
  };

  const handleActorPress = (actor: any) => {
    const actorSlug =
      actor.value_slug ||
      actor.value_text
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-');
    router.push({
      pathname: '/forum/[topic]',
      params: {
        topic: actorSlug,
        title: actor.value_text,
        category: 'actor',
      },
    } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}>
        <Pressable focusable={true} onPress={() => router.push('/')} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Retour à l'accueil</Text>
        </Pressable>

        {/* ======================================================== */}
        {/* 1. MEDIA : Hero Spotlight Header                          */}
        {/* ======================================================== */}
        <View style={styles.heroBox}>
          {fanartUri ? <Image source={{ uri: fanartUri }} style={styles.backdrop} /> : null}
          <View style={styles.heroContent}>
            <View style={styles.zoneRow}>
              {seasonTag ? (
                <View style={styles.seasonTagPill}>
                  <Text style={styles.seasonTagTxt}>{seasonTag}</Text>
                </View>
              ) : null}
              {media.releaseYear ? (
                <View style={styles.metaYearPill}>
                  <Text style={styles.metaYearTxt}>{media.releaseYear}</Text>
                </View>
              ) : null}
              {media.edition ? (
                <View style={[styles.seasonTagPill, styles.editionPill]}>
                  <Text style={[styles.seasonTagTxt, { color: '#c5cedb' }]}>{media.edition}</Text>
                </View>
              ) : null}
              {media.confidenceScore && media.confidenceScore < 0.9 ? (
                <View style={[styles.seasonTagPill, styles.verifyPill]}>
                  <Text style={[styles.seasonTagTxt, { color: '#e2a3a3' }]}>
                    À vérifier ({Math.round(media.confidenceScore * 100)}%)
                  </Text>
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

            {media.tagline ? (
              <Text style={styles.taglineTxt}>« {media.tagline} »</Text>
            ) : null}

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
                <Text style={styles.btnText}>{playLabel}</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={handleToggleFav}
                style={[
                  styles.playBtn,
                  isFav
                    ? { backgroundColor: 'rgba(168, 70, 70, 0.9)' }
                    : { backgroundColor: 'rgba(45, 52, 64, 0.7)' },
                ]}
              >
                <Text style={styles.btnText}>{isFav ? 'Favori' : 'Ajouter aux favoris'}</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() => setShowRepostModal(true)}
                style={[styles.playBtn, { backgroundColor: 'rgba(55, 75, 95, 0.7)' }]}
              >
                <Text style={styles.btnText}>Avis & Repost</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() => setShowCast(true)}
                style={[styles.playBtn, { backgroundColor: 'rgba(50, 65, 85, 0.7)' }]}
              >
                <Text style={styles.btnText}>Diffuser</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={() =>
                  router.push({
                    pathname: '/forum/[topic]',
                    params: { topic: media.slug || media.id, title: media.title },
                  } as any)
                }
                style={[styles.playBtn, { backgroundColor: 'rgba(45, 52, 64, 0.7)' }]}
              >
                <Text style={styles.btnText}>Discussion</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 2. MEDIAS SAGA / SERIE                                   */}
        {/* ======================================================== */}
        {/* Enfants d'une série ou saga parente */}
        <MediaChildrenRow
          parentType={media.nodeType}
          parentPoster={media.posterPath}
          children={children}
        />

        {/* Si c'est un film appartenant à une saga : saga et ses films */}
        {media.nodeType === 'MOVIE' && parentSaga && (
          <MediaSagaRow parentSaga={parentSaga} currentMediaId={media.id} />
        )}

        {/* Bonus, Coulisses et Scènes coupées (Extras) */}
        {extras && extras.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Bonus & Coulisses ({extras.length})</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 8 }}
            >
              {extras.map((extra: any) => (
                <Pressable
                  key={extra.id}
                  focusable={true}
                  onPress={() =>
                    router.push({
                      pathname: `/player/${extra.id}`,
                      params: { title: `${media.title} - ${extra.title}` },
                    } as any)
                  }
                  style={styles.extraCard}
                >
                  <View style={styles.extraThumbWrap}>
                    <Text style={styles.extraThumbTxt}>BONUS</Text>
                    <View style={styles.extraTypeBadge}>
                      <Text style={styles.extraTypeBadgeTxt}>
                        {extra.extraType ? extra.extraType.toUpperCase() : 'BONUS'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.extraTitle} numberOfLines={1}>
                    {extra.title}
                  </Text>
                  {extra.runtimeSeconds ? (
                    <Text style={styles.extraRuntime}>
                      {Math.round(extra.runtimeSeconds / 60)} min
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ======================================================== */}
        {/* 5. ACTEURS : Casting des Acteurs avec Photos et Rôles     */}
        {/* ======================================================== */}
        {actors.length > 0 && (
          <View style={styles.metaSubSection}>
            <View style={styles.secHeaderRow}>
              <Text style={styles.secTitle}>
                {media.nodeType === 'COLLECTION' ? 'Casting de la saga' : 'Casting & Artistes'} ({actors.length})
              </Text>
              <Text style={styles.secHint}>Sélectionnez un artiste pour consulter sa filmographie</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actorsScroll}
            >
              {actors.map((actor: any, idx: number) => {
                const thumb = actor.metadata_json?.thumbUrl;
                return (
                  <Pressable
                    key={idx}
                    focusable={true}
                    onPress={() => handleActorPress(actor)}
                    style={({ pressed }) => [styles.actorCard, pressed && styles.actorCardPressed]}
                  >
                    <View style={styles.actorAvatarWrap}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.actorAvatar} />
                      ) : (
                        <View style={styles.actorAvatarPlaceholder}>
                          <Text style={styles.actorAvatarPlaceholderTxt}>
                            {actor.value_text?.slice(0, 2)?.toUpperCase() || 'ART'}
                          </Text>
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
                    <View style={styles.actorTagBadge}>
                      <Text style={styles.actorTagBadgeTxt}>Artiste</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ======================================================== */}
        {/* 6. EQUIPE : Réalisation & Équipe Créative                 */}
        {/* ======================================================== */}
        {(directors.length > 0 || writers.length > 0 || producers.length > 0 || composers.length > 0) && (
          <View style={styles.metaSubSection}>
            <Text style={styles.secTitle}>Réalisation & Équipe Créative</Text>
            <View style={styles.zoneRow}>
              {directors.map((d: any, i: number) => (
                <TagPill key={`dir-${i}`} label={d.value_text} subtext="Réalisateur" theme="amber" />
              ))}
              {writers.map((w: any, i: number) => (
                <TagPill key={`wri-${i}`} label={w.value_text} subtext="Scénariste / Auteur" theme="emerald" />
              ))}
              {producers.map((p: any, i: number) => (
                <TagPill key={`prod-${i}`} label={p.value_text} subtext="Producteur" theme="indigo" />
              ))}
              {composers.map((m: any, i: number) => (
                <TagPill key={`comp-${i}`} label={m.value_text} subtext="Compositeur" theme="rose" />
              ))}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* 7. INFO : Fiche Technique & Métadonnées                   */}
        {/* ======================================================== */}
        {(ratings.length > 0 || countries.length > 0 || technicalSpecs.length > 0) && (
          <View style={styles.metaSubSection}>
            <Text style={styles.secTitle}>Fiche Technique & Informations</Text>

            {ratings.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.secSubTitle}>Notes & Classification</Text>
                <View style={styles.zoneRow}>
                  {ratings.map((r, i) => (
                    <TagPill key={`rat-${i}`} label={r.value} subtext={r.label} theme={r.theme as any} />
                  ))}
                </View>
              </View>
            )}

            {countries.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.secSubTitle}>Origine & Lieux de tournage</Text>
                <View style={styles.zoneRow}>
                  {countries.map((c: any, i: number) => (
                    <TagPill key={`cnt-${i}`} label={c.value_text} subtext="Pays / Lieu" theme="teal" />
                  ))}
                </View>
              </View>
            )}

            {technicalSpecs.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.secSubTitle}>Caractéristiques techniques & Codecs</Text>
                <View style={styles.zoneRow}>
                  {technicalSpecs.map((t: any, i: number) => (
                    <TagPill
                      key={`tech-${i}`}
                      label={t.value_text}
                      subtext={t.display_name}
                      theme="slate"
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* 3. MEDIAS STUDIOS : Studios et films dépendants associés  */}
        {/* ======================================================== */}
        <MediaStudioSection
          studioMedias={studioMedias}
          studioTags={studios}
          currentMediaId={media.id}
        />

        {/* ======================================================== */}
        {/* 4. FORUM : Section Forum & Vocal Direct                   */}
        {/* ======================================================== */}
        <MediaForumSection
          topicSlug={media.slug || media.id}
          topicTitle={media.title}
          mediaId={media.id}
        />

        {/* ======================================================== */}
        {/* 8. PROPOSITIONS MEDIAS PAR TAGS & AVIS COMMUNAUTAIRES     */}
        {/* ======================================================== */}
        <MediaGenreSection
          currentMediaId={media.id}
          relatedTags={relatedTags}
          fallbackTags={tags.PRIMARY_PILL}
        />

        {/* Section Avis & Reposts communautaires */}
        {reposts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Avis & Retours de la communauté ({reposts.length})</Text>
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
  container: { flex: 1, backgroundColor: '#1d2127' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1d2127' },
  content: { padding: Spacing.four, gap: Spacing.four },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(42, 48, 58, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginBottom: Spacing.two,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  backTxt: { color: '#9ba7b7', fontSize: 13, fontWeight: '600' },
  heroBox: {
    position: 'relative',
    minHeight: 340,
    justifyContent: 'flex-end',
    padding: Spacing.four,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(38, 44, 54, 0.75)',
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 },
  heroContent: { maxWidth: MaxContentWidth, gap: 10 },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  seasonTagPill: {
    backgroundColor: 'rgba(26, 31, 40, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  seasonTagTxt: { color: '#d6dbe3', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  metaYearPill: {
    backgroundColor: 'rgba(26, 31, 40, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  metaYearTxt: { color: '#c5cedb', fontSize: 11, fontWeight: '700' },
  editionPill: {
    backgroundColor: 'rgba(45, 52, 64, 0.85)',
    borderColor: 'rgba(160, 175, 195, 0.2)',
  },
  verifyPill: {
    backgroundColor: 'rgba(120, 40, 40, 0.45)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#edeef2', letterSpacing: -0.5 },
  taglineTxt: { fontSize: 14, fontStyle: 'italic', color: '#9ba7b7', marginVertical: 2 },
  overview: { fontSize: 13, color: '#c5cedb', lineHeight: 20 },
  playBtn: {
    backgroundColor: 'rgba(60, 72, 88, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.16)',
  },
  btnText: { color: '#edeef2', fontWeight: '700', fontSize: 13 },
  section: {
    backgroundColor: 'rgba(38, 44, 54, 0.75)',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    gap: 12,
  },
  secTitle: { fontSize: 16, fontWeight: '700', color: '#edeef2', letterSpacing: -0.3 },
  secSubTitle: { fontSize: 12, fontWeight: '700', color: '#9ba7b7', textTransform: 'uppercase', letterSpacing: 0.5 },
  secHint: { fontSize: 12, color: '#8e9ab0' },
  secHeaderRow: { flexDirection: 'column', gap: 4 },
  infoBlock: { gap: 6, paddingTop: 4 },
  extraCard: { width: 140 },
  extraThumbWrap: {
    width: 140,
    height: 85,
    backgroundColor: 'rgba(26, 31, 40, 0.8)',
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
  },
  extraThumbTxt: { color: '#8e9ab0', fontSize: 11, fontWeight: '700' },
  extraTypeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(20, 24, 33, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  extraTypeBadgeTxt: { color: '#c5cedb', fontSize: 9, fontWeight: '600' },
  extraTitle: { color: '#edeef2', fontSize: 12, fontWeight: '600' },
  extraRuntime: { color: '#8e9ab0', fontSize: 11, marginTop: 2 },
  metaSubSection: {
    backgroundColor: 'rgba(38, 44, 54, 0.75)',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    gap: 12,
  },
  actorsScroll: { gap: 12, paddingVertical: 4 },
  actorCard: {
    width: 100,
    alignItems: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  actorCardPressed: {
    transform: [{ scale: 0.96 }],
  },
  actorAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(26, 31, 40, 0.8)',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  actorAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  actorAvatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 52, 64, 0.8)',
  },
  actorAvatarPlaceholderTxt: { color: '#8e9ab0', fontSize: 14, fontWeight: '700' },
  actorName: { color: '#edeef2', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  actorRole: { color: '#8e9ab0', fontSize: 10, textAlign: 'center', marginTop: 2 },
  actorTagBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(55, 68, 85, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.1)',
  },
  actorTagBadgeTxt: { color: '#a0afc3', fontSize: 9, fontWeight: '600' },
  repostCard: {
    backgroundColor: 'rgba(26, 31, 40, 0.6)',
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.08)',
  },
  repostHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repostAuthor: { color: '#edeef2', fontWeight: '700', fontSize: 12 },
  repostRating: { color: '#fcd34d', fontSize: 12 },
  repostComment: { color: '#c5cedb', fontSize: 12, lineHeight: 18 },
});
