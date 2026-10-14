import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import { fetchFeedReposts } from '@/services/repostApi';
import { resolveImageUrl } from '@/services/api';

export function UserFeedTab() {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedReposts()
      .then(setFeed)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Text style={styles.loadingTxt}>Chargement du fil social...</Text>;
  }

  if (feed.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>🔄</Text>
        <Text style={styles.emptyTitle}>Aucune publication récente</Text>
        <Text style={styles.emptyDesc}>
          Donnez votre avis sur des films ou séries pour les partager avec vos amis, ou ajoutez des amis pour voir leurs recommandations !
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔄 Fil d'Actualité des Amis & Avis ({feed.length})</Text>
      <View style={{ gap: 14 }}>
        {feed.map((item) => {
          const posterUri = resolveImageUrl(item.media?.posterPath);
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/media/${item.media?.id}` as any)}
              style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.author}>{item.author?.displayName || 'Membre'}</Text>
                {item.rating ? <Text style={styles.stars}>{'★'.repeat(item.rating)}</Text> : null}
              </View>

              {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}

              {item.media ? (
                <View style={styles.mediaRow}>
                  {posterUri ? (
                    <Image source={{ uri: posterUri }} style={styles.mediaPoster} resizeMode="cover" />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mediaTitle} numberOfLines={1}>
                      {item.media.title}
                    </Text>
                    {item.media.displayBadge || item.media.seasonEpisodeTag ? (
                      <Text style={styles.badgeTxt}>
                        {item.media.displayBadge || item.media.seasonEpisodeTag}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 14, fontWeight: '800', color: '#818cf8', textTransform: 'uppercase', marginBottom: 4 },
  loadingTxt: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: 20 },
  emptyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 18,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { color: '#f1f5f9', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  emptyDesc: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 400 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  author: { color: '#818cf8', fontWeight: '800', fontSize: 13 },
  stars: { color: '#fbbf24', fontSize: 14 },
  comment: { color: '#e2e8f0', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: Radius.md,
    padding: 8,
  },
  mediaPoster: { width: 36, height: 50, borderRadius: Radius.sm },
  mediaTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 12 },
  badgeTxt: { color: '#818cf8', fontSize: 10, fontWeight: '800', marginTop: 2 },
});
