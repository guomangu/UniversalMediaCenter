import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { fetchLiveChannels } from '@/services/api';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

export default function LiveTvScreen() {
  const [channels, setChannels] = useState<any[]>([]);

  useEffect(() => {
    fetchLiveChannels().then(setChannels);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.heading}>Télévision en Direct (IPTV & EPG)</Text>
          <Text style={styles.badge}>{channels.length} Chaînes</Text>
        </View>
        <View style={styles.grid}>
          {channels.map((ch) => (
            <Link key={ch.id} href={`/player/${ch.id}` as any} asChild>
              <Pressable style={({ pressed }) => [styles.channelCard, pressed && styles.pressed]}>
                <View style={styles.logoWrap}>
                  {ch.clearlogoPath ? (
                    <Image source={{ uri: ch.clearlogoPath }} style={styles.logo} resizeMode="contain" />
                  ) : (
                    <Text style={styles.logoText}>TV</Text>
                  )}
                </View>
                <View style={styles.channelInfo}>
                  <Text style={styles.channelName} numberOfLines={1}>{ch.title}</Text>
                  <Text style={styles.programNow} numberOfLines={1}>🔴 En direct</Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: {
    maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center',
    paddingHorizontal: Spacing.three, paddingBottom: 80,
    paddingTop: Platform.OS === 'web' ? 70 : Spacing.four,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.four },
  heading: { fontSize: 22, fontWeight: '800', color: '#f8fafc' },
  badge: { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  channelCard: {
    minWidth: 160, maxWidth: 280, flexGrow: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.75)', borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)', padding: Spacing.three,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
  },
  logoWrap: { width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: 'rgba(15, 23, 42, 0.6)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 36, height: 36 },
  logoText: { color: '#94a3b8', fontWeight: '700' },
  channelInfo: { flex: 1 },
  channelName: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  programNow: { color: '#f87171', fontSize: 12, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
