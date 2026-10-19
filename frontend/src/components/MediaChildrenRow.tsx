import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl, getVideoStreamUrl } from '@/services/api';
import { Radius } from '@/constants/theme';
import { buildMediaHierarchy, type EpisodeSectionGroup, type ParsedChildNode } from '@/utils/mediaHierarchy';
import { playerStore } from '@/services/playerStore';

interface Props {
  parentType: string;
  parentPoster?: string;
  children: any[];
}

export function MediaChildrenRow({ parentType, parentPoster, children }: Props) {
  const router = useRouter();
  const [selectedTabId, setSelectedTabId] = useState<string>('ALL');

  if (!children || children.length === 0) return null;

  // Si c'est une collection de films : ordonner chronologiquement par année
  if (parentType === 'COLLECTION') {
    const sortedMovies = [...children].sort(
      (a, b) => (a.releaseYear || 0) - (b.releaseYear || 0) || a.orderIndex - b.orderIndex
    );
    return (
      <View style={styles.section}>
        <Text style={styles.secTitle}>Films de cette saga ({sortedMovies.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {sortedMovies.map((m) =>
            renderEpisodeCard(
              {
                node: m,
                tag: m.releaseYear ? `${m.releaseYear}` : 'Film',
                displayTitle: m.title,
                durationLabel: m.runtimeSeconds ? `${Math.round(m.runtimeSeconds / 60)} min` : undefined,
                groupName: 'Films',
                fsSortKey: m.title,
              },
              parentPoster,
              router
            )
          )}
        </ScrollView>
      </View>
    );
  }

  const sections = useMemo(() => buildMediaHierarchy(children), [children]);
  const hasMultipleSections = sections.length > 1;

  const displayedSections = useMemo(() => {
    if (selectedTabId === 'ALL') return sections;
    return sections.filter((s) => s.id === selectedTabId);
  }, [sections, selectedTabId]);

  return (
    <View style={styles.section}>
      {/* Barre d'onglets de filtrage par Saison / Arc (inspiration Kyoo & Netflix) */}
      {hasMultipleSections && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          <Pressable
            focusable={true}
            onPress={() => setSelectedTabId('ALL')}
            style={[styles.tabButton, selectedTabId === 'ALL' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, selectedTabId === 'ALL' && styles.tabTextActive]}>
              Tous ({children.length})
            </Text>
          </Pressable>
          {sections.map((sec) => {
            const isActive = selectedTabId === sec.id;
            return (
              <Pressable
                key={sec.id}
                focusable={true}
                onPress={() => setSelectedTabId(sec.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {sec.shortLabel} ({sec.count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {displayedSections.map(({ id, title, items }) => (
        <View key={id} style={styles.seasonBlock}>
          <Text style={styles.secTitle}>{title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {items.map((item) => renderEpisodeCard(item, parentPoster, router))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function renderEpisodeCard(item: ParsedChildNode, parentPoster: string | undefined, router: any) {
  const { node, tag, displayTitle, durationLabel } = item;
  // Préférer l'artwork d'épisode 16:9 (thumb), sinon poster local, sinon poster parent
  const imgUri = resolveImageUrl(node.thumbPath || node.posterPath || parentPoster);
  const progressPercent = node.progressPercent ?? 0;

  return (
    <Pressable
      focusable={true}
      key={node.id}
      onPress={() => {
        playerStore.openMedia({
          id: String(node.id),
          title: node.title || displayTitle,
          posterUrl: node.thumbPath || node.posterPath || parentPoster,
          streamUrl: getVideoStreamUrl(String(node.id)),
          initialTime: node.progress?.positionSeconds || 0,
          expand: true,
        });
      }}
      style={({ focused }: any) => [styles.tile, focused && styles.tileFocused]}
    >
      <View style={styles.imgWrap}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>ÉPISODE</Text>
          </View>
        )}
        <View style={styles.seasonBadge}>
          <Text style={styles.seasonBadgeTxt}>{tag}</Text>
        </View>
        {durationLabel && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeTxt}>{durationLabel}</Text>
          </View>
        )}
        <View style={styles.playBadge}>
          <Text style={styles.playBadgeTxt}>▶</Text>
        </View>
        {progressPercent > 0 && progressPercent < 95 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {displayTitle}
      </Text>
      {node.director ? (
        <Text style={styles.directorSubtext} numberOfLines={1}>
          🎬 {node.director}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  tabsContainer: {
    gap: 8,
    paddingVertical: 6,
    marginBottom: 16,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(42, 48, 58, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(70, 85, 105, 0.5)',
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  tabText: {
    color: '#8e9ab0',
    fontSize: 12.5,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#edeef2',
    fontWeight: '700',
  },
  seasonBlock: { marginBottom: 24 },
  secTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dfe4ec',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  row: { gap: 14, paddingVertical: 4 },
  tile: {
    width: 220,
    marginRight: 12,
    borderRadius: Radius.md,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  tileFocused: {
    transform: [{ scale: 1.02 }],
    outlineWidth: 2,
    outlineColor: 'rgba(148, 163, 184, 0.75)',
    outlineStyle: 'solid',
  } as any,
  imgWrap: {
    width: 220,
    height: 124, // Format 16:9
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(38, 44, 54, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    position: 'relative',
    marginBottom: 8,
  },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(35, 41, 51, 0.95)' },
  emptyTxt: { color: '#7c8797', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  seasonBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  seasonBadgeTxt: { color: '#d6dbe3', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  durationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  durationBadgeTxt: { color: '#8a95a5', fontSize: 10, fontWeight: '600' },
  playBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.82)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  playBadgeTxt: { color: '#d6dbe3', fontSize: 10, fontWeight: '700' },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(20, 24, 30, 0.6)',
    zIndex: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#b95252',
  },
  title: {
    color: '#dfe4ec',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'left',
  },
  directorSubtext: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '500',
  },
});
