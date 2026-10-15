import React, { useState } from 'react';
import { View, Text, Image, Pressable, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  channel: any;
}

export function TvChannelCard({ channel }: Props) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const title = channel.title || 'Chaîne Live';
  const logo = channel.clearlogoPath;
  const topicSlug = channel.slug || `tv-${channel.id}`;

  const isBrokenCdn = !logo || logo.includes('dc2.oqee.net');
  const category = (channel.searchVectorText?.replace(title, '') || '').trim().split(';')[0]?.trim() || 'Direct';

  const handlePlay = () => {
    router.push({ pathname: '/player/[id]', params: { id: channel.id, title, isLive: '1' } } as any);
  };

  const handleForum = () => {
    router.push({ pathname: '/forum/[topic]', params: { topic: topicSlug, title } } as any);
  };

  return (
    <View style={styles.card}>
      <Pressable focusable={true} onPress={handlePlay} style={styles.topArea}>
        <View style={styles.badgeRow}>
          <Text style={styles.liveBadge}>🔴 EN DIRECT</Text>
          {category ? <Text style={styles.catBadge}>{category}</Text> : null}
        </View>

        <View style={styles.logoWrap}>
          {!isBrokenCdn && !imgError ? (
            <Image
              source={{ uri: logo }}
              style={styles.logoImg}
              resizeMode="contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.fallbackLogo}>
              <Text style={styles.fallbackTxt}>{title.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </Pressable>

      <View style={styles.actionRow}>
        <Pressable focusable={true} onPress={handlePlay} style={[styles.btn, styles.playBtn]}>
          <Text style={styles.playTxt}>▶ Regarder</Text>
        </Pressable>
        <Pressable focusable={true} onPress={handleForum} style={[styles.btn, styles.forumBtn]}>
          <Text style={styles.forumTxt}>💬 Forum</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
    padding: Spacing.two,
    width: 200,
    justifyContent: 'space-between',
  },
  topArea: {
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  liveBadge: { color: '#ef4444', fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  catBadge: { color: '#94a3b8', fontSize: 9, fontWeight: '700', backgroundColor: 'rgba(15, 23, 42, 0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  logoWrap: { height: 70, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoImg: { width: '85%', height: '100%' },
  fallbackLogo: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: '#4338ca', alignItems: 'center', justifyContent: 'center' },
  fallbackTxt: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  title: { color: '#f8fafc', fontWeight: '700', fontSize: 13, minHeight: 34, lineHeight: 17, marginBottom: 8 },
  actionRow: { flexDirection: 'row', gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.25)' },
  btn: { flex: 1, paddingVertical: 6, borderRadius: Radius.pill, alignItems: 'center', cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  playBtn: { backgroundColor: '#6366f1' },
  playTxt: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  forumBtn: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.4)' },
  forumTxt: { color: '#818cf8', fontSize: 11, fontWeight: '700' },
});
