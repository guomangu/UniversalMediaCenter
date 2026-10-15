import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { ForumAssociationsModule } from '@/components/ForumAssociationsModule';
import { fetchForumExplore, ForumExploreResponse, INITIAL_EXPLORE_DATA } from '@/services/forumApi';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function ForumIndexScreen() {
  const router = useRouter();
  const headerPaddingTop = useHeaderHeight(false);
  const [data, setData] = useState<ForumExploreResponse>(INITIAL_EXPLORE_DATA);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchForumExplore()
      .then((res) => {
        if (res) setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeDiscussions = data?.activeDiscussions || [];
  const topStudios = data?.topStudios || [];
  const topGenres = data?.topGenres || [];

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]}
        showsVerticalScrollIndicator={false}>
        <Pressable focusable={true} onPress={() => router.push('/')} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Retour à l'accueil</Text>
        </Pressable>

        {/* Hero Banner Thématique */}
        <View style={styles.heroBox}>
          <View style={styles.heroContent}>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeTxt}>Salons Communautaires</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeTxt}>Échanges, Salles d'attente & Vocal Direct</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Espaces Thématiques & Salons</Text>
            <Text style={styles.heroOverview}>
              Retrouvez l'ensemble des œuvres du patrimoine ordonnées par sujet : acteurs, équipe technique et artistique, structures et studios de production.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#8e9ab0" size="large" />
            <Text style={styles.loadingTxt}>Chargement des espaces communautaires...</Text>
          </View>
        ) : (
          <>
            {/* Discussions Actives */}
            {activeDiscussions.length > 0 ? (
              <View style={styles.sectionWrap}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Salons récemment actifs</Text>
                  <View style={styles.pillCount}>
                    <Text style={styles.pillCountTxt}>{activeDiscussions.length}</Text>
                  </View>
                </View>

                <View style={styles.discussionsGrid}>
                  {activeDiscussions.map((d) => (
                    <Pressable
                      key={d.topicSlug}
                      focusable={true}
                      onPress={() =>
                        router.push({
                          pathname: '/forum/[topic]',
                          params: { topic: d.topicSlug, title: d.topicTitle },
                        } as any)
                      }
                      style={({ pressed }) => [styles.topicCard, pressed && styles.topicCardPressed]}>
                      <View style={styles.topicCardTop}>
                        <Text style={styles.topicCardTitle} numberOfLines={1}>
                          #{d.topicTitle}
                        </Text>
                        <View style={styles.msgBadge}>
                          <Text style={styles.msgBadgeTxt}>
                            {d.msgCount} message{d.msgCount > 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.topicCardSub}>Accéder aux œuvres et à la discussion →</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* 1. MODULE : Œuvres associées */}
            <ForumAssociationsModule
              title="Œuvres associées"
              subtitle="Sélection phare des créations de la médiathèque"
              groups={data?.oeuvreGroups || []}
            />

            {/* 2. MODULE : Acteurs & personnalités associées (les modules "Films avec..." sont conservés sans les tags superflus) */}
            <ForumAssociationsModule
              title="Acteurs & personnalités associées"
              subtitle="Distributions majeures et comédiens phares du catalogue"
              groups={data?.actorGroups || []}
            />

            {/* 3. MODULE : Structures & studios de production */}
            <ForumAssociationsModule
              title="Structures & studios de production"
              subtitle="Découvrez les univers créés par les grands studios et producteurs"
              tags={topStudios.map((s) => ({
                label: s.title,
                slug: s.slug,
                theme: 'teal',
                subtext: `${s.count} titres`,
              }))}
              groups={data?.studioGroups || []}
            />

            {/* 4. MODULE : Genres & origines géographiques */}
            <ForumAssociationsModule
              title="Genres & origines géographiques"
              subtitle="Explorez par univers thématiques et pays de production"
              tags={topGenres.map((g) => ({
                label: g.title,
                slug: g.slug,
                theme: 'emerald',
                subtext: `${g.count} titres`,
              }))}
              groups={data?.genreGroups || []}
            />
          </>
        )}
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
    backgroundColor: 'rgba(29, 33, 39, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.four,
  },
  heroContent: {
    gap: 8,
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
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroOverview: {
    color: '#8e9ab0',
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 720,
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
  sectionWrap: {
    backgroundColor: 'rgba(29, 33, 39, 0.75)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: '#edeef2',
    fontSize: 17,
    fontWeight: '700',
  },
  pillCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  pillCountTxt: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  discussionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: 'rgba(38, 44, 54, 0.65)',
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  topicCardPressed: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  topicCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topicCardTitle: {
    color: '#edeef2',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  msgBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  msgBadgeTxt: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  topicCardSub: {
    color: '#64748b',
    fontSize: 11,
  },
});
