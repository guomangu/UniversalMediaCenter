import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MediaStatsResponse } from '@/services/types';
import { TagPill } from '@/components/TagPill';
import { Radius, Spacing } from '@/constants/theme';

interface ExploreStatsProps {
  stats: MediaStatsResponse;
  onSelectGenre: (genre: string) => void;
}

export const ExploreStats: React.FC<ExploreStatsProps> = ({ stats, onSelectGenre }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Statistiques du Catalogue</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🎬</Text>
          <Text style={styles.statValue}>{stats.totalMovies}</Text>
          <Text style={styles.statLabel}>Films</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📺</Text>
          <Text style={styles.statValue}>{stats.totalShows}</Text>
          <Text style={styles.statLabel}>Séries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🎞️</Text>
          <Text style={styles.statValue}>{stats.totalEpisodes}</Text>
          <Text style={styles.statLabel}>Épisodes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📡</Text>
          <Text style={styles.statValue}>{stats.totalLiveChannels}</Text>
          <Text style={styles.statLabel}>Direct TV</Text>
        </View>
      </View>

      {stats.topGenres && stats.topGenres.length > 0 && (
        <View style={styles.genreSection}>
          <Text style={styles.sectionTitle}>Top Genres & Thématiques</Text>
          <View style={styles.genreWrap}>
            {stats.topGenres.map((g: any) => (
              <TagPill
                key={g.name}
                label={`${g.name} (${g.count})`}
                theme="indigo"
                onPress={() => onSelectGenre(g.name)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: Spacing.two },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.four },
  statCard: {
    flex: 1, minWidth: 70, backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(51, 65, 85, 0.5)',
    padding: Spacing.three, alignItems: 'center', justifyContent: 'center',
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  genreSection: { marginTop: Spacing.two },
  genreWrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
