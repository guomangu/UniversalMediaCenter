import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius } from '@/constants/theme';
import { MediaTileItem } from '@/services/taxonomyApi';
import { useActiveSessionsMap } from '@/services/sessionStore';

export function MediaTile({ item }: { item: MediaTileItem }) {
  const router = useRouter();
  const sessionsMap = useActiveSessionsMap();
  const activeSession = sessionsMap[item.id];
  const poster = resolveImageUrl(item.posterPath);
  const isGroup = item.nodeType === 'SHOW' || item.nodeType === 'COLLECTION';
  const badgeText = item.displayBadge || item.seasonEpisodeTag || (item.nodeType === 'SHOW' ? 'Série' : item.nodeType === 'COLLECTION' ? 'Saga' : 'Film');

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
            <Text style={{ fontSize: 32 }}>{isGroup ? '📺' : '🎬'}</Text>
          </View>
        )}
        
        {/* Badge catégorie / type */}
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badgeText}</Text>
        </View>

        {/* Badge séance active en haut à droite */}
        {activeSession ? (
          <View style={styles.sessionBadgeTop}>
            <Text style={styles.sessionBadgeTopTxt}>🍿 SÉANCE</Text>
          </View>
        ) : null}

        {/* Année */}
        {item.releaseYear ? (
          <View style={styles.yr}>
            <Text style={styles.yrTxt}>{item.releaseYear}</Text>
          </View>
        ) : null}

        {/* Info Séance sur le bas de l'image */}
        {activeSession ? (
          <View style={styles.sessionBottomBar}>
            <Text style={styles.sessionBottomTxt}>
              🍿 {activeSession.count} en séance
            </Text>
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
    width: 200,
    marginRight: 12,
    marginBottom: 16,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  imgWrap: {
    width: 200,
    height: 290,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  sessionBadgeTop: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    shadowColor: '#dc2626',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  sessionBadgeTopTxt: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  yr: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  yrTxt: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  sessionBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBottomTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  title: {
    marginTop: 8,
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
