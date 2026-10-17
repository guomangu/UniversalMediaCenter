import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius, Spacing } from '@/constants/theme';
import { ParentSaga } from '@/services/types';

interface Props {
  parentSaga: ParentSaga;
  currentMediaId: string;
}

function SagaMovieCard({ movie, isCurrent, parentSaga }: { movie: any; isCurrent: boolean; parentSaga: ParentSaga }) {
  const router = useRouter();
  const [imgErr, setImgErr] = useState(false);
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
        {posterUri && !imgErr ? (
          <Image source={{ uri: posterUri }} style={styles.poster} onError={() => setImgErr(true)} />
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

      <Text numberOfLines={1} style={[styles.movieTitle, isCurrent && styles.activeMovieTitle]}>
        {movie.title}
      </Text>
      <Text style={styles.movieYear}>
        {movie.releaseYear || 'Année inconnue'}
      </Text>
    </Pressable>
  );
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
        {sortedMovies.map((movie) => (
          <SagaMovieCard
            key={movie.id}
            movie={movie}
            isCurrent={movie.id === currentMediaId}
            parentSaga={parentSaga}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  countTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93c5fd',
  },
  sagaLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  sagaLinkTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  row: {
    gap: 14,
    paddingVertical: 4,
  },
  card: {
    width: 140,
  },
  activeCard: {
    opacity: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  posterWrap: {
    width: 140,
    height: 210,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    position: 'relative',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholderWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  placeholderTxt: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
  currentBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingTxt: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  movieTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  activeMovieTitle: {
    color: '#60a5fa',
    fontWeight: '800',
  },
  movieYear: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
