import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { ForumAssociationsModule } from '@/components/ForumAssociationsModule';
import { MediaForumSection } from '@/components/MediaForumSection';
import { fetchTopicContext, TopicContextResponse } from '@/services/forumApi';
import { resolveImageUrl } from '@/services/api';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function ForumTopicScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ topic: string; title?: string }>();
  const topicSlug = String(params.topic || '').trim();
  const topicTitle = params.title ? String(params.title).trim() : topicSlug;

  const headerPaddingTop = useHeaderHeight(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const forumSectionY = useRef<number>(0);

  const [context, setContext] = useState<TopicContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotedMedia, setQuotedMedia] = useState<{ id: string; title: string; year?: number | null } | null>(null);

  useEffect(() => {
    if (!topicSlug) return;
    setLoading(true);
    fetchTopicContext(topicSlug)
      .then((data) => {
        if (data) setContext(data);
      })
      .finally(() => setLoading(false));
  }, [topicSlug]);

  const scrollToForum = () => {
    if (forumSectionY.current > 0) {
      scrollViewRef.current?.scrollTo({
        y: forumSectionY.current - 70,
        animated: true,
      });
    }
  };

  const backdropUri = context?.topic?.fanartPath
    ? resolveImageUrl(context.topic.fanartPath)
    : null;

  const totalAssociatedMedias =
    (context?.oeuvreGroups || []).reduce((acc, g) => acc + g.medias.length, 0) +
    (context?.actorGroups || []).reduce((acc, g) => acc + g.medias.length, 0) +
    (context?.studioGroups || []).reduce((acc, g) => acc + g.medias.length, 0) +
    (context?.genreGroups || []).reduce((acc, g) => acc + g.medias.length, 0);

  const tags = context?.tags || {};

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}
        showsVerticalScrollIndicator={false}>
        <Pressable focusable={true} onPress={() => router.push('/forum')} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Retour aux salons</Text>
        </Pressable>

        {/* ========================================================================= */}
        {/* 1. HERO SPOTLIGHT IMMERSIF (Identique à la page média)                   */}
        {/* ========================================================================= */}
        <View style={styles.heroBox}>
          {backdropUri ? (
            <Image
              source={{ uri: backdropUri }}
              style={styles.heroBackdrop}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.heroOverlay} />

          <View style={styles.heroContent}>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeTxt}>Salon Thématique</Text>
              </View>
              {context?.topic?.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeTxt}>{context.topic.category}</Text>
                </View>
              ) : null}
              {totalAssociatedMedias > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeTxt}>{totalAssociatedMedias} œuvres liées</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.heroTitle}>#{context?.topic?.title || topicTitle}</Text>

            {context?.topic?.overview ? (
              <Text style={styles.heroOverview} numberOfLines={3}>
                {context.topic.overview}
              </Text>
            ) : null}

            {/* Barre de navigation rapide */}
            <View style={styles.actionsRow}>
              <Pressable
                focusable={true}
                onPress={scrollToForum}
                style={({ pressed }) => [styles.actionBtnPrimary, pressed && styles.actionBtnPressed]}>
                <Text style={styles.actionBtnPrimaryTxt}>💬 Échanger dans le salon</Text>
              </Pressable>
              <Pressable
                focusable={true}
                onPress={scrollToForum}
                style={({ pressed }) => [styles.actionBtnSecondary, pressed && styles.actionBtnPressed]}>
                <Text style={styles.actionBtnSecondaryTxt}>Rejoindre le salon direct</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#8e9ab0" size="large" />
            <Text style={styles.loadingTxt}>Chargement des œuvres et associations...</Text>
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. MODULE TYPE 1 : Œuvres associées (Style Studios & Productions Associées) */}
            {/* ========================================================================= */}
            <ForumAssociationsModule
              title="Œuvres associées"
              subtitle="Films et séries directement liés à ce sujet"
              groups={context?.oeuvreGroups || []}
            />

            {/* ========================================================================= */}
            {/* 3. MODULE TYPE 2 : Acteurs & personnalités associées                      */}
            {/* ========================================================================= */}
            <ForumAssociationsModule
              title="Acteurs & personnalités associées"
              subtitle="Retrouvez les distributions et comédiens phares de cet univers"
              groups={context?.actorGroups || []}
            />

            {/* ========================================================================= */}
            {/* 4. MODULE TYPE 3 : Structures & studios de production                    */}
            {/* ========================================================================= */}
            <ForumAssociationsModule
              title="Structures & studios de production"
              subtitle="Découvrez les créations issues des mêmes studios et producteurs"
              tags={tags.studios?.map((s) => ({
                label: s.value_text,
                slug: s.value_slug,
                theme: 'teal',
                subtext: s.count ? `${s.count} titres` : undefined,
              }))}
              groups={context?.studioGroups || []}
            />

            {/* ========================================================================= */}
            {/* 5. MODULE TYPE 4 : Genres & origines géographiques                      */}
            {/* ========================================================================= */}
            <ForumAssociationsModule
              title="Genres & origines géographiques"
              subtitle="Explorez par univers thématiques et pays de production"
              tags={[
                ...(tags.genres || []).map((g) => ({
                  label: g.value_text,
                  slug: g.value_slug,
                  theme: 'emerald',
                })),
                ...(tags.countries || []).map((c) => ({
                  label: c.value_text,
                  slug: c.value_slug,
                  theme: 'slate',
                })),
              ]}
              groups={context?.genreGroups || []}
            />
          </>
        )}

        {/* ======================================================== */}
        {/* 6. ESPACE FORUM & SALON DE DISCUSSION DIRECTE            */}
        {/* ======================================================== */}
        <View
          onLayout={(e) => {
            forumSectionY.current = e.nativeEvent.layout.y;
          }}
          style={styles.forumContainer}>
          <MediaForumSection
            topicSlug={topicSlug}
            topicTitle={context?.topic?.title || topicTitle}
            externalQuotedMedia={quotedMedia}
            onClearExternalQuote={() => setQuotedMedia(null)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151a',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(38, 44, 54, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  backTxt: {
    color: '#8e9ab0',
    fontSize: 13,
    fontWeight: '600',
  },
  heroBox: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(29, 33, 39, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 220,
    justifyContent: 'flex-end',
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 21, 26, 0.7)',
  },
  heroContent: {
    padding: Spacing.four,
    gap: 10,
    zIndex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  typeBadgeTxt: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  categoryBadgeTxt: {
    color: '#edeef2',
    fontSize: 11,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  countBadgeTxt: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#edeef2',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroOverview: {
    color: '#8e9ab0',
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 720,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  actionBtnPrimary: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  actionBtnPrimaryTxt: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionBtnSecondaryTxt: {
    color: '#edeef2',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnPressed: {
    opacity: 0.8,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingTxt: {
    color: '#8e9ab0',
    fontSize: 13,
  },
  forumContainer: {
    marginTop: Spacing.two,
  },
});
