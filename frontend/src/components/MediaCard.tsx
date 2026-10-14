import React from 'react';
import { View, Text, Pressable, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MediaNode } from '@/services/types';
import { resolveImageUrl } from '@/services/api';
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

  const cardWidth = isLandscape ? (isMobile ? 200 : 240) : isLive ? (isMobile ? 150 : 180) : (isMobile ? 125 : 150);
  const cardHeight = isLandscape ? (isMobile ? 112 : 135) : isLive ? (isMobile ? 100 : 120) : (isMobile ? 188 : 225);

  const rawUri = item.posterPath || item.thumbPath || item.clearlogoPath || item.fanartPath;
  const imageUri = resolveImageUrl(rawUri);

  const handlePress = () => {
    if (item.nodeType === 'LIVE_CHANNEL') {
      router.push(`/player/${item.id}` as any);
    } else {
      router.push(`/media/${item.id}` as any);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.cardContainer,
        { width: cardWidth },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.imageWrapper, { width: cardWidth, height: cardHeight }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{item.title.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        {item.communityRating ? (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {item.communityRating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      {item.releaseYear ? <Text style={styles.subtext}>{item.releaseYear}</Text> : null}
    </Pressable>
  );
};
