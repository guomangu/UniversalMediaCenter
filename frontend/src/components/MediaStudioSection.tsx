import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius, Spacing } from '@/constants/theme';
import { StudioMediaGroup, TagBadge } from '@/services/types';
import { TagPill } from './TagPill';

interface Props {
  studioMedias?: StudioMediaGroup[];
  studioTags?: TagBadge[];
  currentMediaId?: string;
}

function StudioGroupRail({ group }: { group: StudioMediaGroup }) {
  const router = useRouter();
  const sorted = React.useMemo(() => {
    return [...group.medias].sort(
      (a, b) => (b.releaseYear || 0) - (a.releaseYear || 0)
    );
  }, [group.medias]);

  // Limite initiale de 10 éléments, puis +10 (total 20), puis +12
  const [visibleCount, setVisibleCount] = useState(10);
  const hasMore = visibleCount < sorted.length;
  const nextIncrement = visibleCount <= 10 ? 10 : 12;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => {
      if (prev <= 10) return prev + 10;
      return prev + 12;
    });
  }, []);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 200) {
      if (hasMore) {
        handleLoadMore();
      }
    }
  }, [hasMore, handleLoadMore]);

  const visibleItems = sorted.slice(0, visibleCount);

  return (
    <View key={group.studioName} style={styles.studioGroupBlock}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>Productions {group.studioName}</Text>
        <View style={styles.groupCountBadge}>
          <Text style={styles.groupCountTxt}>
            {sorted.length} titre{sorted.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onScroll={handleScroll}
        scrollEventThrottle={64}
      >
        {visibleItems.map((item) => {
          const posterUri = resolveImageUrl(item.posterPath);
          const typeLabel =
            item.nodeType === 'SHOW'
              ? 'Série'
              : item.nodeType === 'COLLECTION'
              ? 'Saga'
              : 'Film';

          return (
            <Pressable
              key={item.id}
              focusable={true}
              onPress={() => router.push(`/media/${item.id}` as any)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.posterWrap}>
                {posterUri ? (
                  <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
                ) : (
                  <View style={styles.placeholderWrap}>
                    <Text style={styles.placeholderTxt}>{typeLabel.toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeTxt}>{typeLabel}</Text>
                </View>

                {item.communityRating ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingTxt}>★ {Number(item.communityRating).toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>

              {item.releaseYear ? (
                <Text style={styles.yearTxt}>{item.releaseYear}</Text>
              ) : null}
            </Pressable>
          );
        })}

        {hasMore ? (
          <Pressable focusable={true} onPress={handleLoadMore} style={styles.moreTile}>
            <Text style={styles.morePlus}>+{nextIncrement}</Text>
            <Text style={styles.moreTxt}>Afficher plus</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function MediaStudioSection({ studioMedias = [], studioTags = [], currentMediaId }: Props) {
  const groupsWithMedias = studioMedias.filter((g) => g.medias && g.medias.length > 0);
  const allStudioNames = Array.from(
    new Set([
      ...studioTags.map((t) => t.value_text),
      ...studioMedias.map((g) => g.studioName),
    ])
  ).filter(Boolean);

  if (allStudioNames.length === 0 && groupsWithMedias.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.secTitle}>Studios & Productions Associées</Text>
        <Text style={styles.secHint}>Découvrez les autres créations issues des mêmes studios</Text>
      </View>

      {/* Badges de tous les studios de l'œuvre */}
      {allStudioNames.length > 0 && (
        <View style={styles.studioTagsRow}>
          {allStudioNames.map((name, i) => (
            <TagPill
              key={`std-tag-${i}`}
              label={name}
              subtext="Studio"
              theme="sky"
            />
          ))}
        </View>
      )}

      {/* Rails de films et séries dépendants/associés par studio */}
      {groupsWithMedias.map((group) => (
        <StudioGroupRail key={group.studioName} group={group} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(38, 44, 54, 0.75)',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    gap: 16,
  },
  headerRow: {
    flexDirection: 'column',
    gap: 4,
  },
  secTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#edeef2',
    letterSpacing: -0.3,
  },
  secHint: {
    fontSize: 12,
    color: '#8e9ab0',
  },
  studioTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studioGroupBlock: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(160, 175, 195, 0.08)',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c5cedb',
  },
  groupCountBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  groupCountTxt: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  card: {
    width: 120,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  posterWrap: {
    width: 120,
    height: 175,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(26, 31, 40, 0.8)',
    position: 'relative',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTxt: {
    color: '#8e9ab0',
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(20, 24, 33, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  typeBadgeTxt: {
    color: '#c5cedb',
    fontSize: 9,
    fontWeight: '600',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(20, 24, 33, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ratingTxt: {
    color: '#fcd34d',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    color: '#c5cedb',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  yearTxt: {
    color: '#8e9ab0',
    fontSize: 11,
    marginTop: 2,
  },
  moreTile: {
    width: 110,
    height: 175,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.2)',
    backgroundColor: 'rgba(45, 52, 64, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  morePlus: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  moreTxt: {
    color: '#8e9ab0',
    fontSize: 11,
    fontWeight: '600',
  },
});
