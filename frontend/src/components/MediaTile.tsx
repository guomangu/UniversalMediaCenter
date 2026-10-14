import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius } from '@/constants/theme';
import { MediaTileItem } from '@/services/taxonomyApi';

export function MediaTile({ item }: { item: MediaTileItem }) {
  const router = useRouter();
  const poster = resolveImageUrl(item.posterPath);
  const isGroup = item.nodeType === 'SHOW' || item.nodeType === 'COLLECTION';
  const badgeText = item.nodeType === 'SHOW' ? 'Série' : item.nodeType === 'COLLECTION' ? 'Saga' : 'Film';

  const handleOpenMedia = () => {
    router.push(`/media/${item.id}` as any);
  };

  return (
    <Pressable
      focusable={true}
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}
      onPress={handleOpenMedia}>
      <View style={styles.imgWrap}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={styles.empty}>
            <Text style={{ fontSize: 24 }}>{isGroup ? '📺' : '🎬'}</Text>
          </View>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badgeText}</Text>
        </View>
        {item.releaseYear ? (
          <View style={styles.yr}>
            <Text style={styles.yrTxt}>{item.releaseYear}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 112,
    marginRight: 8,
    marginBottom: 12,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  imgWrap: {
    width: 112,
    height: 160,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeTxt: { color: '#818cf8', fontSize: 9, fontWeight: '700' },
  yr: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  yrTxt: { color: '#94a3b8', fontSize: 9, fontWeight: '600' },
  title: {
    marginTop: 5,
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center',
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
