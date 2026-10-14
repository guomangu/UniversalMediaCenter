import React from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius } from '@/constants/theme';
import { buildMediaHierarchy } from '@/utils/mediaHierarchy';

interface Props {
  parentType: string;
  parentPoster?: string;
  children: any[];
}

export function MediaChildrenRow({ parentType, parentPoster, children }: Props) {
  const router = useRouter();
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
          {sortedMovies.map((m) => renderTile(m, m.releaseYear ? `${m.releaseYear}` : 'Film', parentPoster, router))}
        </ScrollView>
      </View>
    );
  }

  const sections = buildMediaHierarchy(children);

  return (
    <View style={styles.section}>
      {sections.map(({ id, title, items }) => (
        <View key={id} style={styles.seasonBlock}>
          <Text style={styles.secTitle}>{title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {items.map(({ node, tag }) => renderTile(node, tag, parentPoster, router))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function renderTile(node: any, tag: string, parentPoster: string | undefined, router: any) {
  const imgUri = resolveImageUrl(node.posterPath || parentPoster);
  return (
    <Pressable
      focusable={true}
      key={node.id}
      onPress={() => router.push(`/player/${node.id}` as any)}
      style={styles.tile}
    >
      <View style={styles.imgWrap}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={styles.empty}><Text style={{ fontSize: 32 }}>🎬</Text></View>
        )}
        <View style={styles.seasonBadge}><Text style={styles.seasonBadgeTxt}>{tag}</Text></View>
        <View style={styles.playBadge}><Text style={styles.playBadgeTxt}>▶</Text></View>
      </View>
      <Text style={styles.title} numberOfLines={2}>{node.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  seasonBlock: { marginBottom: 22 },
  secTitle: { fontSize: 16, fontWeight: '800', color: '#c7d2fe', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: { gap: 14, paddingVertical: 4 },
  tile: { width: 200, marginRight: 12, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  imgWrap: {
    width: 200, height: 285, borderRadius: Radius.lg, overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.85)', borderWidth: 1.5, borderColor: 'rgba(99, 102, 241, 0.35)',
    position: 'relative', marginBottom: 8,
  },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seasonBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(99, 102, 241, 0.95)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill,
  },
  seasonBadgeTxt: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  playBadge: {
    position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(99, 102, 241, 0.95)',
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  playBadgeTxt: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  title: { color: '#f1f5f9', fontSize: 13, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
});
