import React from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius } from '@/constants/theme';

interface Props {
  parentType: string;
  parentPoster?: string;
  children: any[];
}

export function MediaChildrenRow({ parentType, parentPoster, children }: Props) {
  const router = useRouter();
  if (children.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.secTitle}>
        {parentType === 'SHOW' ? `Épisodes (${children.length})` : `Films de cette suite (${children.length})`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {children.map((c) => {
          const imgUri = resolveImageUrl(c.posterPath || parentPoster);
          const seasonTag = c.displayBadge || c.seasonEpisodeTag;

          return (
            <Pressable
              focusable={true}
              key={c.id}
              onPress={() => router.push(`/player/${c.id}` as any)}
              style={styles.tile}>
              <View style={styles.imgWrap}>
                {imgUri ? (
                  <Image source={{ uri: imgUri }} style={styles.img} resizeMode="cover" />
                ) : (
                  <View style={styles.empty}>
                    <Text style={{ fontSize: 24 }}>🎬</Text>
                  </View>
                )}
                {seasonTag ? (
                  <View style={styles.seasonBadge}>
                    <Text style={styles.seasonBadgeTxt}>{seasonTag}</Text>
                  </View>
                ) : null}
                <View style={styles.playBadge}>
                  <Text style={styles.playBadgeTxt}>▶</Text>
                </View>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {c.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  secTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: { gap: 8, paddingVertical: 4 },
  tile: { width: 120, marginRight: 8, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  imgWrap: {
    width: 120,
    height: 165,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    position: 'relative',
    marginBottom: 5,
  },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seasonBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  seasonBadgeTxt: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  playBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadgeTxt: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  title: { color: '#f1f5f9', fontSize: 11, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
});
