import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius, Spacing } from '@/constants/theme';
import { TagPill } from './TagPill';
import { AssociationGroup } from '@/services/forumApi';

interface TagItem {
  label: string;
  slug?: string;
  subtext?: string;
  theme?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  tags?: TagItem[];
  groups?: AssociationGroup[];
}

function AssociationRail({ group }: { group: AssociationGroup }) {
  const router = useRouter();
  const sorted = React.useMemo(() => {
    return [...group.medias].sort(
      (a, b) => (Number(b.communityRating) || 0) - (Number(a.communityRating) || 0)
    );
  }, [group.medias]);

  // Limite initiale de 10 éléments, puis +10 (total 20), puis +12 à chaque étape
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
    <View key={group.name} style={styles.groupBlock}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{group.name}</Text>
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
                  <Image source={{ uri: posterUri }} style={styles.poster} />
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

export function ForumAssociationsModule({
  title,
  subtitle,
  tags = [],
  groups = [],
}: Props) {
  const groupsWithMedias = (groups || []).filter((g) => g.medias && g.medias.length > 0);
  if (groupsWithMedias.length === 0 && tags.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.secTitle}>{title}</Text>
        {subtitle ? <Text style={styles.secHint}>{subtitle}</Text> : null}
      </View>

      {/* Badges / Tags associés à cette section */}
      {tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.map((t, i) => (
            <TagPill
              key={`tag-${t.slug || t.label}-${i}`}
              label={t.label}
              subtext={t.subtext}
              theme={t.theme || 'slate'}
            />
          ))}
        </View>
      )}

      {/* Rails de films et séries ordonnés par groupe d'association */}
      {groupsWithMedias.map((group) => (
        <AssociationRail key={group.name} group={group} />
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
    marginBottom: Spacing.four,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupBlock: {
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
    width: 130,
    gap: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  posterWrap: {
    width: 130,
    height: 185,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#151921',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(38, 44, 54, 0.7)',
  },
  placeholderTxt: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(29, 33, 39, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  typeBadgeTxt: {
    color: '#c5cedb',
    fontSize: 9,
    fontWeight: '700',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  ratingTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#edeef2',
    marginTop: 2,
    lineHeight: 16,
  },
  yearTxt: {
    fontSize: 11,
    color: '#8e9ab0',
  },
  moreTile: {
    width: 112,
    height: 185,
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
