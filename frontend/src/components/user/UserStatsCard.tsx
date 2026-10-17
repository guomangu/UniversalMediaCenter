import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  userStats: {
    watchHours: number;
    completedMedia: number;
    favoritesCount: number;
    friendsCount: number;
    repostsCount: number;
    forumsCount: number;
  };
  mediaStats: {
    movies: number;
    shows: number;
    episodes: number;
    channels: number;
  };
}

export function UserStatsCard({ userStats, mediaStats }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>📊 Mes Statistiques & Activité</Text>
      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.watchHours} h</Text>
          <Text style={styles.statLbl}>Temps visionné</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.completedMedia}</Text>
          <Text style={styles.statLbl}>Médias terminés</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.favoritesCount}</Text>
          <Text style={styles.statLbl}>Favoris</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.friendsCount}</Text>
          <Text style={styles.statLbl}>Amis</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.repostsCount}</Text>
          <Text style={styles.statLbl}>Avis & Reposts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.forumsCount}</Text>
          <Text style={styles.statLbl}>Salons actifs</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>🌐 Médias Accessibles</Text>
      <View style={styles.mediaSummaryRow}>
        <Text style={styles.mediaBadge}>🎬 {mediaStats.movies} Films</Text>
        <Text style={styles.mediaBadge}>📺 {mediaStats.shows} Séries</Text>
        <Text style={styles.mediaBadge}>🍿 {mediaStats.episodes} Épisodes</Text>
        <Text style={styles.mediaBadge}>🔴 {mediaStats.channels} TV Direct</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#818cf8',
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  mediaSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
});
