import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MediaNode } from '@/services/types';
import { TagPill } from './TagPill';
import { styles } from './HeroSpotlight.styles';

interface HeroSpotlightProps {
  item?: MediaNode;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({ item }) => {
  const router = useRouter();
  if (!item) return null;

  const bgUri = item.fanartPath || item.posterPath;

  return (
    <View style={styles.container}>
      {bgUri ? <Image source={{ uri: bgUri }} style={styles.backdrop} resizeMode="cover" /> : null}
      <View style={styles.overlay}>
        <View style={styles.badgeRow}>
          {item.releaseYear ? <TagPill label={String(item.releaseYear)} theme="slate" /> : null}
          {item.communityRating ? (
            <TagPill label={`★ ${item.communityRating.toFixed(1)}`} theme="amber" />
          ) : null}
          <TagPill label="4K HDR" theme="indigo" />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.tagline ? <Text style={styles.tagline}>{item.tagline}</Text> : null}
        {item.overview ? (
          <Text style={styles.overview} numberOfLines={3}>
            {item.overview}
          </Text>
        ) : null}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.playBtn, pressed && styles.btnPressed]}
            onPress={() => router.push(`/player/${item.id}` as any)}>
            <Text style={styles.playText}>▶ Regarder</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.detailBtn, pressed && styles.btnPressed]}
            onPress={() => router.push(`/media/${item.id}` as any)}>
            <Text style={styles.detailText}>ℹ Détails</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
