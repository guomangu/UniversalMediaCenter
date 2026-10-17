import React, { useState } from 'react';
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
  const [imgErr, setImgErr] = useState(false);
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
        {poster && !imgErr ? (
          <Image source={{ uri: poster }} style={styles.img} resizeMode="cover" onError={() => setImgErr(true)} />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>{isGroup ? 'SÉRIE' : 'FILM'}</Text>
          </View>
        )}
        
        {/* Badge catégorie / type */}
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badgeText}</Text>
        </View>

        {/* Badge séance active en haut à droite */}
        {activeSession ? (
          <View style={styles.sessionBadgeTop}>
            <Text style={styles.sessionBadgeTopTxt}>EN SÉANCE</Text>
          </View>
        ) : null}

        {/* Badge Résolution / Qualité dynamique */}
        {item.videoQuality ? (
          <View style={[styles.qualityBadge, activeSession && styles.qualityBadgeWithSession]}>
            <Text style={styles.qualityBadgeTxt}>{item.videoQuality}</Text>
          </View>
        ) : null}

        {/* Année */}
        {item.releaseYear ? (
          <View style={[styles.yr, activeSession && styles.yrWithSession]}>
            <Text style={styles.yrTxt}>{item.releaseYear}</Text>
          </View>
        ) : null}

        {/* Info Séance sur le bas de l'image */}
        {activeSession ? (
          <View style={styles.sessionBottomBar}>
            <Text style={styles.sessionBottomTxt}>
              {activeSession.count} en séance
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
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(38, 44, 54, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(35, 41, 51, 0.95)' },
  emptyTxt: { color: '#7c8797', fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeTxt: { color: '#d6dbe3', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  sessionBadgeTop: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(168, 70, 70, 0.9)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  sessionBadgeTopTxt: { color: '#ffffff', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  qualityBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(130, 170, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: Radius.sm,
  },
  qualityBadgeWithSession: {
    bottom: 26,
  },
  qualityBadgeTxt: {
    color: '#93b6ff',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  yr: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(26, 31, 40, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  yrWithSession: {
    bottom: 26,
  },
  yrTxt: { color: '#8a95a5', fontSize: 10, fontWeight: '600' },
  sessionBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(150, 58, 58, 0.92)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBottomTxt: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    marginTop: 8,
    color: '#dfe4ec',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
