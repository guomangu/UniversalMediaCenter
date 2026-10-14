import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import { fetchUserForums } from '@/services/userApi';

export function UserForumsTab() {
  const router = useRouter();
  const [forums, setForums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserForums()
      .then(setForums)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Text style={styles.loadingTxt}>Chargement de vos discussions...</Text>;
  }

  if (forums.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyTitle}>Aucun salon pour le moment</Text>
        <Text style={styles.emptyDesc}>
          Participez aux forums WhatsApp de vos films, séries, animes ou chaînes TV pour retrouver vos échanges ici !
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💬 Salons où vous avez participé ({forums.length})</Text>
      <View style={{ gap: 10 }}>
        {forums.map((f) => (
          <Pressable
            key={f.topicSlug}
            focusable={true}
            onPress={() =>
              router.push({
                pathname: '/forum/[topic]',
                params: {
                  topic: f.topicSlug,
                  title: f.topicTitle,
                },
              } as any)
            }
            style={styles.forumCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.topicTitle}>{f.topicTitle}</Text>
              <Text style={styles.topicSlug}>#{f.topicSlug}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{f.msgCount} message(s)</Text>
            </View>
          </Pressable>
        ))}
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
  forumCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  topicTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  topicSlug: { color: '#818cf8', fontSize: 11, fontWeight: '600' },
  badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  badgeTxt: { color: '#818cf8', fontWeight: '800', fontSize: 11 },
});
