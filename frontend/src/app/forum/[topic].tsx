import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchTopicMessages, postTopicMessage, ForumMessage } from '@/services/forumApi';
import { ForumMessageBubble } from '@/components/ForumMessageBubble';
import { ForumInputBar } from '@/components/ForumInputBar';
import { MaxContentWidth } from '@/constants/theme';

export default function ForumTopicScreen() {
  const router = useRouter();
  const { topic, title } = useLocalSearchParams<{ topic: string; title?: string }>();
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyMsg, setReplyMsg] = useState<ForumMessage | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const topicTitle = title || (typeof topic === 'string' ? topic : 'Sujet');

  const loadMessages = async () => {
    if (!topic) return;
    const list = await fetchTopicMessages(String(topic));
    setMessages(list);
    setLoading(false);
  };

  useEffect(() => { loadMessages(); }, [topic]);

  const handleSend = async (payload: { content: string; mediaType: string; mediaUrl?: string; fileName?: string }) => {
    if (!topic) return;
    await postTopicMessage(String(topic), {
      topicTitle,
      content: payload.content,
      authorName: 'Moi',
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl,
      fileName: payload.fileName,
      replyToId: replyMsg?.id,
      replyToText: replyMsg?.content,
      replyToAuthor: replyMsg?.authorName,
    });
    setReplyMsg(null);
    await loadMessages();
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topicName} numberOfLines={1}>💬 #{topicTitle}</Text>
          <Text style={styles.subTxt}>{messages.length} message(s) • WhatsApp Style</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color="#6366f1" style={{ marginVertical: 30 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyTxt}>Aucun message dans ce forum. Soyez le premier à partager !</Text>
        ) : (
          messages.map((m) => (
            <ForumMessageBubble key={m.id} msg={m} isMe={m.authorName === 'Moi'} onReply={(msg) => setReplyMsg(msg)} />
          ))
        )}
      </ScrollView>

      <ForumInputBar replyMsg={replyMsg} onCancelReply={() => setReplyMsg(null)} onSend={handleSend} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: 'rgba(71,85,105,0.4)' },
  backBtn: { paddingRight: 12, paddingVertical: 4 },
  backTxt: { color: '#818cf8', fontSize: 20, fontWeight: 'bold' },
  topicName: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  subTxt: { color: '#94a3b8', fontSize: 11 },
  scroll: { flex: 1 },
  scrollContent: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', padding: 12, paddingBottom: 20 },
  emptyTxt: { color: '#64748b', textAlign: 'center', marginVertical: 40, fontStyle: 'italic' },
});
