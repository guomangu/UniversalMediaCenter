import React from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius } from '@/constants/theme';

interface Props {
  parentType: string;
  parentPoster?: string;
  children: any[];
}

export function MediaChildrenRow({ parentType, parentPoster, children }: Props) {
  const router = useRouter();
  if (children.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.secTitle}>
        {parentType === 'SHOW' ? `Épisodes (${children.length})` : `Films de cette suite (${children.length})`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {children.map((c) => {
          const imgUri = resolveImageUrl(c.posterPath || parentPoster);
          return (
            <Pressable focusable={true} key={c.id} onPress={() => router.push(`/player/${c.id}` as any)} style={styles.tile}>
              <View style={styles.imgWrap}>
                {imgUri ? (
                  <Image source={{ uri: imgUri }} style={styles.img} resizeMode="cover" />
                ) : (
                  <View style={styles.empty}><Text style={{ fontSize: 24 }}>🎬</Text></View>
                )}
                <View style={styles.badge}><Text style={styles.badgeTxt}>▶</Text></View>
              </View>
              <Text style={styles.title} numberOfLines={2}>{c.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  secTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 },
  row: { gap: 8, paddingVertical: 4 },
  tile: { width: 114, marginRight: 6, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  imgWrap: { width: 114, height: 160, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: 'rgba(30, 41, 59, 0.85)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)', position: 'relative', marginBottom: 5 },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(99, 102, 241, 0.9)', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  title: { color: '#f1f5f9', fontSize: 11, fontWeight: '600', lineHeight: 14, textAlign: 'center' },
});
