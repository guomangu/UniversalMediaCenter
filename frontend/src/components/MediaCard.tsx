import React, { useState } from 'react';
import { View, Text, Pressable, Image, useWindowDimensions, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { MediaNode } from '@/services/types';
import { resolveImageUrl } from '@/services/api';
import { useActiveSessionsMap } from '@/services/sessionStore';
import { styles } from './MediaCard.styles';

interface MediaCardProps {
  item: MediaNode;
  styleVariant?: 'POSTER' | 'LANDSCAPE' | 'LIVE_CARD';
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, styleVariant = 'POSTER' }) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const isLandscape = styleVariant === 'LANDSCAPE';
  const isLive = styleVariant === 'LIVE_CARD';
  const sessionsMap = useActiveSessionsMap();
  const activeSession = sessionsMap[item.id];
  const hasActiveSession = Boolean(activeSession && activeSession.count > 0);

  // Format 2 fois plus grand comme Kyoo, tout en préservant le ratio d'aspect cinéma (2:3 pour posters, 16:9 pour paysage)
  const cardWidth = isLandscape
    ? (isMobile ? 260 : 380)
    : isLive
    ? (isMobile ? 200 : 260)
    : (isMobile ? 180 : 260);

  const cardHeight = isLandscape
    ? (isMobile ? 146 : 214)
    : isLive
    ? (isMobile ? 135 : 175)
    : (isMobile ? 270 : 390);

  const rawUri = item.posterPath || item.thumbPath || item.clearlogoPath || item.fanartPath;
  const imageUri = resolveImageUrl(rawUri);
  const targetHref = item.nodeType === 'LIVE_CHANNEL' ? `/player/${item.id}?isLive=1` : `/media/${item.id}`;

  const seasonTag = item.displayBadge || item.seasonEpisodeTag;
  const [imgError, setImgError] = useState(false);
  const progressPercent = item.progressPercent ?? 0;
  const isUnavailableChannel = item.nodeType === 'LIVE_CHANNEL' && (item.state === 'ERROR' || item.state === 'MISSING_FILE');

  return (
    <Link href={targetHref as any} asChild>
      <Pressable
        onPress={() => router.push(targetHref as any)}
        style={({ pressed }) => [
          styles.cardContainer,
          { width: cardWidth },
          isUnavailableChannel && { opacity: 0.6 },
          pressed && styles.pressed,
        ]}>
        <View
          style={[
            styles.imageWrapper,
            { width: cardWidth, height: cardHeight },
            isUnavailableChannel && (Platform.OS === 'web' ? { filter: 'grayscale(100%)' } : { opacity: 0.7 }) as any,
          ]}
        >
          {imageUri && !imgError ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" onError={() => setImgError(true)} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>{item.title.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}

          {item.state === 'ERROR' ? (
            <View style={[styles.ratingBadge, { backgroundColor: 'rgba(239, 68, 68, 0.92)', right: 8 }]}>
              <Text style={[styles.ratingText, { color: '#ffffff', fontWeight: '800' }]}>INCOMPLET</Text>
            </View>
          ) : isUnavailableChannel ? (
            <View style={[styles.ratingBadge, { backgroundColor: 'rgba(217, 119, 6, 0.92)', right: 8 }]}>
              <Text style={[styles.ratingText, { color: '#ffffff', fontWeight: '800' }]}>HORS LIGNE</Text>
            </View>
          ) : isLive ? (
            <View style={[styles.ratingBadge, { backgroundColor: 'rgba(220, 38, 38, 0.88)', right: 8 }]}>
              <Text style={[styles.ratingText, { color: '#ffffff', fontWeight: '800' }]}>DIRECT</Text>
            </View>
          ) : null}

          {seasonTag ? (
            <View style={styles.seasonBadge}>
              <Text style={styles.seasonBadgeText}>{seasonTag}</Text>
            </View>
          ) : null}

          {hasActiveSession ? (
            <View style={[styles.ratingBadge, { backgroundColor: 'rgba(168, 70, 70, 0.9)', left: 8, right: undefined }]}>
              <Text style={[styles.ratingText, { color: '#ffffff', fontWeight: '700', letterSpacing: 0.5 }]}>EN SÉANCE</Text>
            </View>
          ) : null}

          {item.communityRating && !isLive ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{item.communityRating.toFixed(1)}</Text>
            </View>
          ) : null}

          {hasActiveSession ? (
            <View style={{
              position: 'absolute',
              bottom: (progressPercent > 0 && progressPercent < 95) ? 6 : 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(150, 58, 58, 0.92)',
              paddingVertical: 4,
              alignItems: 'center',
              zIndex: 10,
            }}>
              <Text style={{ color: '#ffffff', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 }}>
                {activeSession.count} en séance
              </Text>
            </View>
          ) : null}

          {progressPercent > 0 && progressPercent < 95 ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[styles.title, isUnavailableChannel && { color: '#94a3b8' }]}
        >
          {item.title}
        </Text>
        {item.releaseYear ? <Text style={styles.subtext}>{item.releaseYear}</Text> : null}
      </Pressable>
    </Link>
  );
};
