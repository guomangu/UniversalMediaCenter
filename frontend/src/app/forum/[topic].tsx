import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ForumTopMediasRail } from '@/components/ForumTopMediasRail';
import { MediaForumSection } from '@/components/MediaForumSection';
import { MediaTileItem } from '@/services/taxonomyApi';
import { SiteHeader, useHeaderHeight } from '@/components/SiteHeader';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function ForumTopicScreen() {
  const router = useRouter();
  const headerPaddingTop = useHeaderHeight(false);
  const { topic, title, category } = useLocalSearchParams<{
    topic: string;
    title?: string;
    category?: string;
  }>();

  const topicSlug = typeof topic === 'string' ? topic : 'sujet';
  const topicTitle = title || topicSlug;
  const catSlug = typeof category === 'string' ? category : 'genres';

  const [quotedMedia, setQuotedMedia] = useState<{ id: string; title: string; poster?: string } | null>(null);

  const handleProposeSessionMedia = (item: MediaTileItem) => {
    setQuotedMedia({
      id: item.id,
      title: item.title,
      poster: item.posterPath,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <SiteHeader />
      <View style={[styles.header, { marginTop: headerPaddingTop }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topicName} numberOfLines={1}>
            💬 #{topicTitle}
          </Text>
          <Text style={styles.subTxt}>Forum communautaire • Séances & Vocal direct</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Rail des 10 médias au-dessus du forum (sans doublons) */}
        <ForumTopMediasRail
          topic={topicSlug}
          topicTitle={topicTitle}
          category={catSlug}
          onProposeSession={handleProposeSessionMedia}
        />

        {/* Espace Forum unifié & Salle d'attente de Séance */}
        <MediaForumSection
          topicSlug={topicSlug}
          topicTitle={topicTitle}
          externalQuotedMedia={quotedMedia}
          onClearExternalQuote={() => setQuotedMedia(null)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71,85,105,0.4)',
  },
  backBtn: { paddingRight: 12, paddingVertical: 4 },
  backTxt: { color: '#818cf8', fontSize: 20, fontWeight: 'bold' },
  topicName: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  subTxt: { color: '#94a3b8', fontSize: 11 },
  scroll: { flex: 1 },
  scrollContent: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    padding: 12,
    paddingBottom: 40,
  },
});
