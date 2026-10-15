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
import { fetchTopicContext, TopicContextResponse, TopicTagItem } from '@/services/forumApi';
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
        contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + Spacing.three }]}
        showsVerticalScrollIndicator={false}>
        {/* Bouton Retour vers le Forum */}
        <Pressable
          focusable={true}
          onPress={() => router.push('/forum' as any)}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.backTxt}>← Retour à l'Agora & salons</Text>
        </Pressable>

        {/* ======================================================== */}
        {/* 1. EN-TÊTE IMMERSIF DU TOPIC (Hero Card)                 */}
        {/* ======================================================== */}
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
                <Text style={styles.typeBadgeTxt}>
                  {context?.topic?.typeLabel || 'Sujet d’Agora'}
                </Text>
              </View>
              {context?.topic?.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeTxt}>{context.topic.category}</Text>
                </View>
              ) : null}
              {totalAssociatedMedias > 0 ? (
                <View style={styles.mediaCountBadge}>
                  <Text style={styles.mediaCountBadgeTxt}>
                    🎬 {totalAssociatedMedias} œuvre{totalAssociatedMedias > 1 ? 's' : ''} associée{totalAssociatedMedias > 1 ? 's' : ''}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.heroTitle}>{context?.topic?.title || topicTitle}</Text>

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
              tags={tags.studios?.map((s: TopicTagItem) => ({
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
                ...(tags.genres || []).map((g: TopicTagItem) => ({
                  label: g.value_text,
                  slug: g.value_slug,
                  theme: 'emerald',
                })),
                ...(tags.countries || []).map((c: TopicTagItem) => ({
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
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
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
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  typeBadgeTxt: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  categoryBadgeTxt: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  mediaCountBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  mediaCountBadgeTxt: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroOverview: {
    fontSize: 14,
    lineHeight: 22,
    color: '#94a3b8',
    maxWidth: 800,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  actionBtnPrimary: {
    backgroundColor: '#6366f1',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
  },
  actionBtnPressed: {
    opacity: 0.8,
  },
  actionBtnPrimaryTxt: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSecondaryTxt: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: 12,
  },
  loadingTxt: {
    color: '#8e9ab0',
    fontSize: 14,
  },
  forumContainer: {
    marginTop: Spacing.four,
  },
});
