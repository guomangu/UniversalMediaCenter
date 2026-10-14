import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveImageUrl } from '@/services/api';
import { Radius } from '@/constants/theme';
import { MediaTileItem } from '@/services/taxonomyApi';
import { ClickableTopicText } from './ClickableTopicText';

export function MediaTile({ item }: { item: MediaTileItem }) {
  const router = useRouter();
  const poster = resolveImageUrl(item.posterPath);
  const isShow = item.nodeType === 'SHOW' || item.nodeType === 'COLLECTION';

  return (
    <View style={styles.box}>
      <Pressable
        style={({ pressed }) => [styles.imgWrap, pressed && styles.pressed]}
        onPress={() => router.push(`/media/${item.id}` as any)}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={styles.empty}><Text style={{ fontSize: 24 }}>{isShow ? '📺' : '🎬'}</Text></View>
        )}
        <View style={styles.badge}><Text style={styles.badgeTxt}>{isShow ? 'Série' : item.nodeType === 'MOVIE' ? 'Film' : 'EP'}</Text></View>
        {item.releaseYear ? <View style={styles.yr}><Text style={styles.yrTxt}>{item.releaseYear}</Text></View> : null}
      </Pressable>
      <ClickableTopicText
        text={item.title}
        topicTitle={item.title}
        numberOfLines={2}
        style={styles.title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 112, marginRight: 8, marginBottom: 12 },
  imgWrap: {
    width: 112, height: 160, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.85)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.pill },
  badgeTxt: { color: '#818cf8', fontSize: 9, fontWeight: '700' },
  yr: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: Radius.sm },
  yrTxt: { color: '#94a3b8', fontSize: 9, fontWeight: '600' },
  title: { marginTop: 5, color: '#f1f5f9', fontSize: 11, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
