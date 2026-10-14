import React from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet } from 'react-native';
import { ForumMessage } from '@/services/forumApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { Radius } from '@/constants/theme';

interface Props {
  msg: ForumMessage;
  isMe: boolean;
  onReply: (m: ForumMessage) => void;
}

export function ForumMessageBubble({ msg, isMe, onReply }: Props) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullUrl = msg.mediaUrl
    ? msg.mediaUrl.startsWith('http')
      ? msg.mediaUrl
      : `${getApiBaseUrl()}${msg.mediaUrl}`
    : undefined;

  return (
    <View style={[styles.wrap, isMe ? styles.wrapRight : styles.wrapLeft]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {msg.replyToText ? (
          <View style={styles.quoteBox}>
            <Text style={styles.quoteAuthor}>{msg.replyToAuthor || 'Message cité'}</Text>
            <Text style={styles.quoteText} numberOfLines={2}>{msg.replyToText}</Text>
          </View>
        ) : null}

        {fullUrl && (msg.mediaType === 'IMAGE' || msg.mediaType === 'GIF') ? (
          <Image source={{ uri: fullUrl }} style={styles.mediaImg} resizeMode="cover" />
        ) : null}

        {fullUrl && msg.mediaType === 'VIDEO' ? (
          <Pressable focusable={true} onPress={() => Linking.openURL(fullUrl)} style={styles.mediaPill}>
            <Text style={styles.pillText}>▶️ Vidéo : {msg.fileName || 'Ouvrir la vidéo'}</Text>
          </Pressable>
        ) : null}

        {fullUrl && msg.mediaType === 'AUDIO' ? (
          <Pressable focusable={true} onPress={() => Linking.openURL(fullUrl)} style={styles.mediaPill}>
            <Text style={styles.pillText}>🎙️ Vocal : {msg.fileName || 'Écouter l’audio'}</Text>
          </Pressable>
        ) : null}

        {fullUrl && msg.mediaType === 'DOCUMENT' ? (
          <Pressable focusable={true} onPress={() => Linking.openURL(fullUrl)} style={styles.mediaPill}>
            <Text style={styles.pillText}>📄 Document : {msg.fileName || 'Télécharger le fichier'}</Text>
          </Pressable>
        ) : null}

        {fullUrl && msg.mediaType === 'LINK' ? (
          <Pressable focusable={true} onPress={() => Linking.openURL(fullUrl)} style={styles.mediaPill}>
            <Text style={[styles.pillText, { color: '#93c5fd' }]}>🔗 {msg.mediaUrl}</Text>
          </Pressable>
        ) : null}

        {msg.content ? <Text style={styles.content}>{msg.content}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.author}>{msg.authorName}</Text>
          <Text style={styles.time}>{time}</Text>
          <Pressable focusable={true} onPress={() => onReply(msg)} style={styles.replyBtn}>
            <Text style={styles.replyText}>↩</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10, width: '100%', flexDirection: 'row' },
  wrapLeft: { justifyContent: 'flex-start' },
  wrapRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: Radius.md, padding: 10 },
  bubbleMe: { backgroundColor: '#4338ca', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: 'rgba(30, 41, 59, 0.9)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.4)', borderBottomLeftRadius: 2 },
  quoteBox: { borderLeftWidth: 3, borderLeftColor: '#818cf8', backgroundColor: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: Radius.sm, marginBottom: 6 },
  quoteAuthor: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
  quoteText: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' },
  mediaImg: { width: '100%', height: 180, borderRadius: Radius.sm, marginBottom: 6 },
  mediaPill: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: Radius.sm, marginBottom: 6 },
  pillText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  content: { color: '#ffffff', fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
  author: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginRight: 'auto' },
  time: { color: '#cbd5e1', fontSize: 10, opacity: 0.8 },
  replyBtn: { paddingHorizontal: 4 },
  replyText: { color: '#93c5fd', fontSize: 12, fontWeight: 'bold' },
});
