import React from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius, Spacing } from '@/constants/theme';
import { ParentSaga } from '@/services/types';

interface Props {
  parentSaga: ParentSaga;
  currentMediaId: string;
}

export function MediaSagaRow({ parentSaga, currentMediaId }: Props) {
  const router = useRouter();

  if (!parentSaga || !parentSaga.movies || parentSaga.movies.length === 0) return null;

  const sortedMovies = [...parentSaga.movies].sort(
    (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0) || (a.releaseYear || 0) - (b.releaseYear || 0)
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.secTitle}>Saga : {parentSaga.title}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countTxt}>{sortedMovies.length} film{sortedMovies.length > 1 ? 's' : ''}</Text>
          </View>
        </View>

        <Pressable
          focusable={true}
          onPress={() => router.push(`/media/${parentSaga.id}` as any)}
          style={styles.sagaLinkBtn}
        >
          <Text style={styles.sagaLinkTxt}>Fiche Saga →</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {sortedMovies.map((movie) => {
          const isCurrent = movie.id === currentMediaId;
          const posterUri = resolveImageUrl(movie.posterPath || parentSaga.posterPath);

          return (
            <Pressable
              key={movie.id}
              focusable={true}
              onPress={() => {
                if (!isCurrent) router.push(`/media/${movie.id}` as any);
              }}
              style={({ pressed }) => [
                styles.card,
                isCurrent && styles.activeCard,
                pressed && !isCurrent && styles.cardPressed,
              ]}
            >
              <View style={styles.posterWrap}>
                {posterUri ? (
                  <Image source={{ uri: posterUri }} style={styles.poster} />
                ) : (
                  <View style={styles.placeholderWrap}>
                    <Text style={styles.placeholderTxt}>FILM</Text>
                  </View>
                )}

                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeTxt}>Ce film</Text>
                  </View>
                ) : null}

                {movie.communityRating ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingTxt}>★ {Number(movie.communityRating).toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.title, isCurrent && styles.activeTitle]} numberOfLines={2}>
                {movie.title}
              </Text>

              {movie.releaseYear ? (
                <Text style={styles.yearTxt}>{movie.releaseYear}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  secTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#edeef2',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  countTxt: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  sagaLinkBtn: {
    backgroundColor: 'rgba(55, 68, 85, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.18)',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  sagaLinkTxt: {
    color: '#c5cedb',
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  card: {
    width: 130,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  activeCard: {
    opacity: 0.95,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  posterWrap: {
    width: 130,
    height: 190,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(26, 31, 40, 0.8)',
    position: 'relative',
    marginBottom: 6,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTxt: {
    color: '#8e9ab0',
    fontSize: 11,
    fontWeight: '700',
  },
  currentBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.92)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  currentBadgeTxt: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(20, 24, 33, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ratingTxt: {
    color: '#fcd34d',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    color: '#c5cedb',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  activeTitle: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  yearTxt: {
    color: '#8e9ab0',
    fontSize: 11,
    marginTop: 2,
  },
});
