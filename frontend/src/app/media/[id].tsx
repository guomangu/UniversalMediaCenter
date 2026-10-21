import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Platform, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMediaDetail, resolveImageUrl, getVideoStreamUrl, getDownloadUrl } from '@/services/api';
import { getAuthToken } from '@/services/authStore';
import { getApiBaseUrl } from '@/services/apiConfig';
import { playerStore } from '@/services/playerStore';
import { checkFavorite, toggleFavorite } from '@/services/userApi';
import { fetchMediaReposts, deleteRepost, MediaRepostItem } from '@/services/repostApi';
import { fetchMediaSessions, MediaSession } from '@/services/sessionApi';
import { MediaDetailResponse } from '@/services/types';
import { getCachedData } from '@/services/pwaDataCache';
import { getCurrentUser } from '@/services/authStore';
import { TagPill } from '@/components/TagPill';
import { ClickableTopicText } from '@/components/ClickableTopicText';
import { MediaChildrenRow } from '@/components/MediaChildrenRow';
import { MediaCard } from '@/components/MediaCard';
import { MediaSagaRow } from '@/components/MediaSagaRow';
import { MediaStudioSection } from '@/components/MediaStudioSection';
import { MediaGenreSection } from '@/components/MediaGenreSection';
import { MediaRepostModal } from '@/components/MediaRepostModal';
import { MediaForumSection } from '@/components/MediaForumSection';
import { ProposeSessionModal } from '@/components/ProposeSessionModal';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { CastModal } from '@/components/CastModal';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';
import { goBackOrFallback } from '@/utils/navigation';

export default function MediaDetailScreen() {
  const { id, share } = useLocalSearchParams<{ id: string; share?: string }>();
  const router = useRouter();
  const headerPaddingTop = useHeaderHeight(false);
  const user = getCurrentUser();
  const userKey = user ? `${user.id}_${user.isAdmin ? 'admin' : (user as any).profileRole || 'user'}` : 'anon';
  const cacheKey = `media_detail_${userKey}_${id}${share ? `_${share}` : ""}`;
  const initialCached = id ? getCachedData<MediaDetailResponse>(cacheKey) : null;
  const [data, setData] = useState<MediaDetailResponse | null>(initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [isForbidden, setIsForbidden] = useState(false);
  const [showCast, setShowCast] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [reposts, setReposts] = useState<MediaRepostItem[]>([]);
  const [repostStats, setRepostStats] = useState<{ averageRating: number | null; totalCount: number }>({
    averageRating: null,
    totalCount: 0,
  });
  const [activeSessions, setActiveSessions] = useState<MediaSession[]>([]);
  const [totalViewers, setTotalViewers] = useState(0);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const loadReposts = () => {
    if (!id) return;
    fetchMediaReposts(id).then((res) => {
      setReposts(res.reposts || []);
      setRepostStats({ averageRating: res.averageRating, totalCount: res.totalCount });
    });
  };

  const loadSessions = () => {
    if (!id) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    fetchMediaSessions(id).then((res) => {
      setActiveSessions((prev) => {
        const next = res.sessions || [];
        if (
          prev.length === next.length &&
          prev.every((s, i) => s.id === next[i]?.id && s.currentPosition === next[i]?.currentPosition)
        ) {
          return prev;
        }
        return next;
      });
      setTotalViewers((prev) => (prev === (res.totalViewers || 0) ? prev : (res.totalViewers || 0)));
    });
  };

  const loadData = () => {
    if (!id) return;
    if (!data) setLoading(true);
    fetchMediaDetail(id, share)
      .then((res) => {
        if (!res) {
          const loggedUser = getCurrentUser();
          if (!loggedUser) {
            router.replace({
              pathname: '/login',
              params: {
                returnUrl: `/media/${id}${share ? `?share=${share}` : ''}`,
                error: 'Connexion requise pour accéder à cette œuvre ou lien expiré',
              },
            } as any);
          } else {
            setIsForbidden(true);
          }
        } else if (res.forbidden) {
          setIsForbidden(true);
        } else {
          setIsForbidden(false);
          setData(res);
        }
      })
      .finally(() => setLoading(false));

    checkFavorite(id).then(setIsFav);
    loadReposts();
    loadSessions();
  };

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined" && document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur?.();
      }
    };
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, [id, share]);

  const handleToggleFav = async () => {
    if (!id) return;
    const nextState = !isFav;
    setIsFav(nextState);
    await toggleFavorite(id, nextState);
  };

  const handleDeleteRepost = async (repostId: string) => {
    const ok = await deleteRepost(repostId);
    if (ok) {
      loadReposts();
    }
  };

  const {
    media,
    tags = { HERO_BADGE: [], PRIMARY_PILL: [], PERSON_CAROUSEL: [], TECHNICAL_DRAWER: [] },
    children = [],
    extras = [],
    parentSaga = null,
    studioMedias = [],
    relatedTags = [],
    similarMedias = [],
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

  if (isForbidden) {
    return (
      <SafeAreaView style={styles.container}>
        <SiteHeader />
        <View style={[styles.content, { paddingTop: headerPaddingTop + 30, alignItems: 'center' }]}>
          <Pressable
            focusable={true}
            accessibilityRole="button"
            onPress={() => goBackOrFallback(router, '/')}
            style={styles.backBtn}>
            <Text style={styles.backTxt}>← Retour à l'accueil</Text>
          </Pressable>
          <View style={styles.forbiddenCard}>
            <Text style={styles.forbiddenIcon}>🔒</Text>
            <Text style={styles.forbiddenTitle}>Contenu Restreint</Text>
            <Text style={styles.forbiddenDesc}>
              Ce contenu multimédia ou son répertoire physique n'est pas autorisé pour votre profil d'utilisateur.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
    const user = getCurrentUser();
    if (!user && !share) {
      router.push({
        pathname: "/login",
        params: { returnUrl: `/media/${id}` },
      } as any);
      return;
    }
    if (typeof document !== "undefined" && document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur?.();
    }
    const isChannel = media.nodeType === "LIVE_CHANNEL" || Boolean(media.streamUrl);
    const filePath = (media.videoFilePath || '').toLowerCase();
    const isNonNativeContainer = !filePath.endsWith('.mp4') && !filePath.endsWith('.webm');
    const useHls = Boolean(media.requiresHls || (media.nodeType !== 'LIVE_CHANNEL' && (!filePath || isNonNativeContainer)));
    const apiBase = getApiBaseUrl();
    const authToken = getAuthToken();
    const streamUrl = isChannel && media.streamUrl
      ? (media.streamUrl.startsWith("http")
          ? `${apiBase}/api/iptv/proxy?url=${encodeURIComponent(media.streamUrl)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`
          : getVideoStreamUrl(playId, share))
      : getVideoStreamUrl(playId, share, useHls);

    playerStore.openMedia({
      id: String(playId),
      title: media.title,
      slug: media.slug,
      posterUrl: fanartUri || resolveImageUrl(media.posterPath),
      streamUrl,
      isLive: isChannel,
      initialTime: media.resumePositionSeconds || 0,
      expand: true,
    });
  };

  const handlePersonPress = (person: any) => {
    const slug =
      person.value_slug ||
      person.value_text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-');
    router.push({
      pathname: '/person/[slug]',
      params: {
        slug,
        name: person.value_text,
        role: person.attr_code || '',
      },
    } as any);
  };

  const handleActorPress = (actor: any) => handlePersonPress(actor);

  const handleDownload = async () => {
    if (!user) {
      router.push({
        pathname: '/login',
        params: { returnUrl: `/media/${id}`, error: 'Connexion requise pour télécharger cette œuvre' },
      } as any);
      return;
    }

    if (!user.isAdmin && (user as any).canDownload === false) {
      setDownloadNotice('Le téléchargement hors-ligne est désactivé pour votre profil par un administrateur.');
      return;
    }

    const url = getDownloadUrl(media.id, share);
    setDownloadNotice('Préparation du téléchargement…');

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = '';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setDownloadNotice('Téléchargement lancé dans votre navigateur.');
        setTimeout(() => setDownloadNotice(null), 6000);
      } catch {
        setDownloadNotice("Le téléchargement n'a pas pu démarrer. Réessayez depuis un navigateur.");
      }
      return;
    }

    try {
      await Linking.openURL(url);
      setDownloadNotice('Téléchargement ouvert dans votre gestionnaire de fichiers.');
    } catch {
      setDownloadNotice('Impossible de lancer le téléchargement sur cet appareil.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}>
        <Pressable
          focusable={true}
          accessibilityRole="button"
          onPress={() => goBackOrFallback(router, '/')}
          style={styles.backBtn}>
          <Text style={styles.backTxt}>← Retour</Text>
        </Pressable>

        {/* Bannière Séance Collective en Direct si active */}
        {activeSessions.length > 0 && (
          <View style={styles.liveSessionBanner}>
            <View style={styles.liveSessionPulse}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveSessionBannerTxt}>
                Séance de visionnage active • {totalViewers} spectateur{totalViewers > 1 ? 's' : ''} en direct
              </Text>
            </View>
            <Pressable
              focusable={true}
              onPress={() =>
                router.push({
                  pathname: `/player/${playId}`,
                  params: { sessionId: activeSessions[0].id, title: media.title },
                } as any)
              }
              style={styles.liveSessionJoinBtn}
            >
              <Text style={styles.liveSessionJoinBtnTxt}>Rejoindre le salon ▶</Text>
            </Pressable>
          </View>
        )}

        {/* ======================================================== */}
        {/* 1. MEDIA : Hero Spotlight Header                          */}
        {/* ======================================================== */}
        <View style={styles.heroBox}>
          {fanartUri ? <Image source={{ uri: fanartUri }} style={styles.backdrop} resizeMode="cover" /> : null}
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

            {directors.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginVertical: 4 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700' }}>🎬 Réalisé par :</Text>
                {directors.map((d, idx) => (
                  <Pressable
                    key={idx}
                    focusable={true}
                    onPress={() => handlePersonPress(d)}
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.25)',
                      borderColor: 'rgba(129, 140, 248, 0.4)',
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 14,
                    }}
                  >
                    <Text style={{ color: '#c7d2fe', fontSize: 12.5, fontWeight: '700' }}>
                      {d.value_text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {media.overview ? (
              <ClickableTopicText
                text={media.overview}
                topicSlug={media.slug || media.id}
                topicTitle={media.title}
                style={styles.overview}
              />
            ) : null}

                        {media.state === "ERROR" && (
              <View style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "#ef4444", borderWidth: 1, padding: 12, borderRadius: 10, marginVertical: 8, maxWidth: 640 }}>
                <Text style={{ color: "#fca5a5", fontSize: 13, fontWeight: "700" }}>
                  ⚠️ Fichier vidéo incomplet ou corrompu sur le disque source
                </Text>
                <Text style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                  Le téléchargement de ce fichier multimédia n'a pas été achevé sur le disque de stockage. La lecture directe sera disponible dès que le fichier aura été complété ou remplacé.
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              <Pressable focusable={true} onPress={handlePlay} style={styles.playBtn}>
                <Text style={styles.btnText}>{playLabel}</Text>
              </Pressable>

              {/* Bouton Favoris YouTube-Quality */}
              <Pressable
                focusable={true}
                onPress={handleToggleFav}
                style={[
                  styles.playBtn,
                  isFav
                    ? { backgroundColor: '#e11d48', borderColor: '#f43f5e', borderWidth: 1 }
                    : { backgroundColor: 'rgba(51, 65, 85, 0.75)' },
                ]}
              >
                <Text style={styles.btnText}>{isFav ? '❤️ Dans mes favoris' : '🤍 Ajouter aux favoris'}</Text>
              </Pressable>

              {/* Bouton Salon de visionnage / Watch Party */}
              <Pressable
                focusable={true}
                onPress={() => {
                  if (activeSessions.length > 0) {
                    router.push({
                      pathname: `/player/${playId}`,
                      params: { sessionId: activeSessions[0].id, title: media.title },
                    } as any);
                  } else {
                    setShowSessionModal(true);
                  }
                }}
                style={[
                  styles.playBtn,
                  activeSessions.length > 0
                    ? { backgroundColor: '#16a34a', borderColor: '#4ade80', borderWidth: 1 }
                    : { backgroundColor: 'rgba(99, 102, 241, 0.8)' },
                ]}
              >
                <Text style={styles.btnText}>
                  {activeSessions.length > 0
                    ? `🔴 Séance active (${totalViewers})`
                    : '🍿 Salon de visionnage'}
                </Text>
              </Pressable>

              {/* Bouton Donner mon avis */}
              <Pressable
                focusable={true}
                onPress={() => setShowRepostModal(true)}
                style={[styles.playBtn, { backgroundColor: 'rgba(55, 75, 95, 0.75)' }]}
              >
                <Text style={styles.btnText}>✍️ Avis & Repost</Text>
              </Pressable>

              {/* Bouton Salon de discussion */}
              <Pressable
                focusable={true}
                onPress={() =>
                  router.push({
                    pathname: '/forum/[topic]',
                    params: {
                      topic: media.slug || media.id,
                      title: media.title,
                    },
                  } as any)
                }
                style={[styles.playBtn, { backgroundColor: 'rgba(30, 41, 59, 0.85)' }]}
              >
                <Text style={styles.btnText}>💬 Salon de discussion</Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => setShowCast(true)}
                style={[styles.playBtn, { backgroundColor: 'rgba(50, 65, 85, 0.7)' }]}
              >
                <Text style={styles.btnText}>Diffuser sur l'écran</Text>
              </Pressable>

              {media.videoFilePath && !media.streamUrl && media.nodeType !== 'LIVE_CHANNEL' && (
                <Pressable
                  focusable={true}
                  onPress={handleDownload}
                  style={[
                    styles.playBtn,
                    { backgroundColor: 'rgba(16, 185, 129, 0.22)', borderColor: 'rgba(52, 211, 153, 0.45)', borderWidth: 1 },
                  ]}
                >
                  <Text style={[styles.btnText, { color: '#a7f3d0' }]}>⬇ Télécharger</Text>
                </Pressable>
              )}
            </View>

            {downloadNotice && (
              <View style={styles.downloadNotice}>
                <Text style={styles.downloadNoticeTxt}>{downloadNotice}</Text>
              </View>
            )}
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
                  onPress={() => {
                    if (typeof document !== "undefined" && document.activeElement && document.activeElement !== document.body) {
                      (document.activeElement as HTMLElement).blur?.();
                    }
                    playerStore.openMedia({
                      id: String(extra.id),
                      title: extra.title,
                      posterUrl: fanartUri || resolveImageUrl(media.posterPath),
                      streamUrl: getVideoStreamUrl(extra.id, share),
                      isLive: false,
                      initialTime: 0,
                      expand: true,
                    });
                  }}
                  style={styles.extraCard}
                >
                  <View style={styles.extraPosterBox}>
                    <Text style={{ fontSize: 24 }}>🎬</Text>
                  </View>
                  <Text style={styles.extraTitle} numberOfLines={1}>
                    {extra.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ======================================================== */}
        {/* 2.bis DISTRIBUTION & REALISATION                         */}
        {/* ======================================================== */}
        {(directors.length > 0 || actors.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>🎬 Distribution & Réalisation</Text>
            {directors.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700' }}>Réalisation :</Text>
                {directors.map((d: any, idx: number) => (
                  <Pressable
                    key={idx}
                    focusable={true}
                    onPress={() => handlePersonPress(d)}
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.25)',
                      borderColor: 'rgba(129, 140, 248, 0.4)',
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 16,
                    }}
                  >
                    <Text style={{ color: '#c7d2fe', fontSize: 13, fontWeight: '700' }}>
                      {d.value_text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {[
              { label: 'Scénario', list: writers, color: 'rgba(16, 185, 129, 0.22)', border: 'rgba(52, 211, 153, 0.4)', text: '#a7f3d0' },
              { label: 'Production', list: producers, color: 'rgba(56, 189, 248, 0.2)', border: 'rgba(125, 211, 252, 0.4)', text: '#bae6fd' },
              { label: 'Musique', list: composers, color: 'rgba(244, 114, 182, 0.18)', border: 'rgba(249, 168, 212, 0.4)', text: '#fbcfe8' },
            ].map((group) =>
              group.list.length > 0 ? (
                <View
                  key={group.label}
                  style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}
                >
                  <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700' }}>{group.label} :</Text>
                  {group.list.map((person: any, idx: number) => (
                    <Pressable
                      key={`${group.label}-${idx}`}
                      focusable={true}
                      onPress={() => handlePersonPress(person)}
                      style={{
                        backgroundColor: group.color,
                        borderColor: group.border,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 16,
                      }}
                    >
                      <Text style={{ color: group.text, fontSize: 13, fontWeight: '700' }}>
                        {person.value_text}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null
            )}

            {actors.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingVertical: 8 }}
              >
                {actors.map((actor: any, idx: number) => {
                  const thumbUri = actor.metadata_json?.thumbUrl || actor.metadata?.thumbUrl;
                  return (
                    <Pressable
                      key={idx}
                      focusable={true}
                      onPress={() => handleActorPress(actor)}
                      style={{
                        width: 104,
                        backgroundColor: 'rgba(30, 41, 59, 0.65)',
                        borderRadius: 10,
                        padding: 8,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(148, 163, 184, 0.15)',
                      }}
                    >
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: '#1e293b',
                          overflow: 'hidden',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        {thumbUri ? (
                          <Image
                            source={{ uri: thumbUri }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={{ fontSize: 24 }}>🎭</Text>
                        )}
                      </View>
                      <Text
                        style={{ color: '#f8fafc', fontSize: 12, fontWeight: '700', textAlign: 'center' }}
                        numberOfLines={2}
                      >
                        {actor.value_text}
                      </Text>
                      {actor.context_role ? (
                        <Text
                          style={{ color: '#94a3b8', fontSize: 10.5, marginTop: 2, textAlign: 'center' }}
                          numberOfLines={1}
                        >
                          {actor.context_role}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
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

        {/* Recommandations TF-IDF / BM25 calculées côté serveur */}
        {similarMedias && similarMedias.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>✨ Recommandations pour vous</Text>
            <Text style={{ color: '#8e9ab0', fontSize: 12, marginTop: 2, marginBottom: 6 }}>
              Œuvres proches par leurs genres, réalisateurs, acteurs et studios
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 8 }}
            >
              {similarMedias.map((item: any) => (
                <MediaCard key={item.id} item={item} styleVariant="POSTER" />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Section Avis & Critiques de la communauté YouTube-Quality */}
        <View style={styles.section}>
          <View style={styles.repostSecHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.secTitle}>💬 Avis & Critiques ({reposts.length})</Text>
              {repostStats.averageRating ? (
                <View style={styles.avgRatingBadge}>
                  <Text style={styles.avgRatingStar}>★</Text>
                  <Text style={styles.avgRatingTxt}>{repostStats.averageRating} / 5</Text>
                </View>
              ) : null}
            </View>
            <Pressable
              focusable={true}
              onPress={() => setShowRepostModal(true)}
              style={styles.addReviewBtn}
            >
              <Text style={styles.addReviewBtnTxt}>+ Donner mon avis</Text>
            </Pressable>
          </View>

          {reposts.length === 0 ? (
            <View style={styles.emptyRepostBox}>
              <Text style={styles.emptyRepostTxt}>
                Aucun avis pour l'instant. Partagez votre critique avec la communauté !
              </Text>
              <Pressable
                focusable={true}
                onPress={() => setShowRepostModal(true)}
                style={styles.emptyReviewActionBtn}
              >
                <Text style={styles.emptyReviewActionTxt}>✍️ Rédiger une critique</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {reposts.map((r) => (
                <View key={r.id} style={styles.repostCard}>
                  <View style={styles.repostHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.repostAvatar}>{r.author?.avatarUrl || '👤'}</Text>
                      <Text style={styles.repostAuthor}>{r.author?.displayName || 'Membre'}</Text>
                      {r.isMine ? (
                        <View style={styles.mineBadge}>
                          <Text style={styles.mineBadgeTxt}>Moi</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {r.rating ? <Text style={styles.repostRating}>{'★'.repeat(r.rating)}</Text> : null}
                      {r.isMine ? (
                        <Pressable focusable={true} onPress={() => handleDeleteRepost(r.id)}>
                          <Text style={styles.delAvisTxt}>✕</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {r.comment ? <Text style={styles.repostComment}>« {r.comment} »</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modale de proposition de salon de visionnage */}
      <ProposeSessionModal
        visible={showSessionModal}
        nodeId={media.id}
        topicSlug={media.slug || media.id}
        defaultTitle={`Séance collective : ${media.title}`}
        onClose={() => setShowSessionModal(false)}
        onCreated={(session) => {
          setShowSessionModal(false);
          loadSessions();
          router.push({
            pathname: `/player/${playId}`,
            params: { sessionId: session.id, title: media.title },
          } as any);
        }}
      />

      {/* Modale d'avis & repost */}
      <MediaRepostModal
        visible={showRepostModal}
        mediaId={media.id}
        mediaTitle={media.title}
        onClose={() => setShowRepostModal(false)}
        onSuccess={() => {
          loadReposts();
        }}
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
  liveSessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  liveSessionPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveSessionBannerTxt: {
    color: '#fecaca',
    fontSize: 13,
    fontWeight: '800',
  },
  liveSessionJoinBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  liveSessionJoinBtnTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  forbiddenCard: {
    backgroundColor: 'rgba(38, 44, 54, 0.85)',
    borderRadius: Radius.lg,
    padding: Spacing.five,
    maxWidth: 480,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 12,
    marginTop: 40,
  },
  forbiddenIcon: { fontSize: 48 },
  forbiddenTitle: { color: '#f87171', fontSize: 20, fontWeight: '800' },
  forbiddenDesc: { color: '#cbd5e1', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  heroBox: {
    position: 'relative',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(38, 44, 54, 0.7)',
    minHeight: 280,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
  },
  heroContent: {
    padding: Spacing.five,
    gap: Spacing.two,
    backgroundColor: 'rgba(29, 33, 39, 0.65)',
  },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#edeef2', letterSpacing: -0.5 },
  taglineTxt: { fontSize: 14, fontStyle: 'italic', color: '#c5cedb', marginTop: -2 },
  overview: { fontSize: 14, color: '#c5cedb', lineHeight: 20, maxWidth: 800 },
  playBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  section: {
    backgroundColor: 'rgba(38, 44, 54, 0.6)',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.1)',
  },
  secTitle: { fontSize: 15, fontWeight: '800', color: '#818cf8', letterSpacing: 0.3 },
  repostSecHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  avgRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  avgRatingStar: { color: '#fbbf24', fontSize: 12 },
  avgRatingTxt: { color: '#fde68a', fontSize: 11, fontWeight: '800' },
  addReviewBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  addReviewBtnTxt: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  emptyRepostBox: {
    padding: 16,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 14,
  },
  emptyRepostTxt: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  emptyReviewActionBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  emptyReviewActionTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '700' },
  extraCard: { width: 140, gap: 6 },
  extraPosterBox: {
    width: 140,
    height: 80,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(55, 68, 85, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.1)',
  },
  extraTitle: { color: '#edeef2', fontSize: 12, fontWeight: '600' },
  seasonTagPill: {
    backgroundColor: 'rgba(65, 80, 105, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  editionPill: { backgroundColor: 'rgba(55, 68, 85, 0.4)' },
  verifyPill: { backgroundColor: 'rgba(150, 50, 50, 0.4)' },
  seasonTagTxt: { color: '#e8edf5', fontSize: 11, fontWeight: '700' },
  metaYearPill: {
    backgroundColor: 'rgba(40, 50, 65, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  metaYearTxt: { color: '#c5cedb', fontSize: 11, fontWeight: '700' },
  repostCard: {
    backgroundColor: 'rgba(26, 31, 40, 0.6)',
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.08)',
  },
  repostHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repostAvatar: { fontSize: 16 },
  repostAuthor: { color: '#edeef2', fontWeight: '700', fontSize: 12 },
  mineBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  mineBadgeTxt: { color: '#a5b4fc', fontSize: 9, fontWeight: '800' },
  delAvisTxt: { color: '#f87171', fontSize: 13, fontWeight: '800', paddingHorizontal: 4 },
  repostRating: { color: '#fcd34d', fontSize: 12 },
  repostComment: { color: '#c5cedb', fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  downloadNotice: {
    marginTop: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 640,
  },
  downloadNoticeTxt: { color: '#a7f3d0', fontSize: 12.5, lineHeight: 18 },
});
