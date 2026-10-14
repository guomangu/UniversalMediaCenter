import React from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ForumMessage } from '@/services/forumApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { resolveImageUrl } from '@/services/api';
import { InlineAudioPlayer } from './InlineAudioPlayer';
import { Radius } from '@/constants/theme';

interface Props {
  msg: ForumMessage;
  isMe: boolean;
  onReply: (m: ForumMessage) => void;
  onVote?: (msgId: string) => void;
}

export function ForumMessageBubble({ msg, isMe, onReply, onVote }: Props) {
  const router = useRouter();
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullUrl = msg.mediaUrl
    ? msg.mediaUrl.startsWith('http')
      ? msg.mediaUrl
      : `${getApiBaseUrl()}${msg.mediaUrl}`
    : undefined;

  const quotedPosterUri = msg.quotedMediaPoster ? resolveImageUrl(msg.quotedMediaPoster) : null;

  return (
    <View style={[styles.wrap, isMe ? styles.wrapRight : styles.wrapLeft]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {/* Entête de l'auteur avec sa dernière page / média connu sous son nom */}
        <View style={styles.authorHeader}>
          <Text style={styles.author}>{msg.authorName}</Text>

          {/* Dernière page connue ou média actuellement regardé */}
          {msg.authorLocation ? (
            <Pressable
              focusable={true}
              onPress={() => router.push(msg.authorLocation!.path as any)}
              style={[
                styles.authorLocationBadge,
                msg.authorLocation.isLive && styles.authorLocationBadgeLive,
              ]}
            >
              <Text style={styles.authorLocationText} numberOfLines={1}>
                {msg.authorLocation.isLive ? '🔴 En séance : ' : '📍 '}
                {msg.authorLocation.title}
              </Text>
              <Text style={styles.authorLocationJoin}>Rejoindre ➔</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Citation textuelle classique */}
        {msg.replyToText ? (
          <View style={styles.quoteBox}>
            <Text style={styles.quoteAuthor}>{msg.replyToAuthor || 'Message cité'}</Text>
            <Text style={styles.quoteText} numberOfLines={2}>{msg.replyToText}</Text>
          </View>
        ) : null}

        {/* Citation d'une œuvre / média pour séance */}
        {msg.quotedMediaId ? (
          <Pressable
            focusable={true}
            onPress={() => router.push(`/media/${msg.quotedMediaId}` as any)}
            style={styles.quotedMediaCard}
          >
            {quotedPosterUri ? (
              <Image source={{ uri: quotedPosterUri }} style={styles.quotedMediaPoster} />
            ) : (
              <View style={styles.quotedMediaPlaceholder}>
                <Text style={{ fontSize: 16 }}>🎬</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.quotedMediaLabel}>🍿 Œuvre citée pour séance</Text>
              <Text style={styles.quotedMediaTitle} numberOfLines={1}>
                {msg.quotedMediaTitle || 'Média'}
              </Text>
            </View>
            <Text style={styles.quotedMediaArrow}>▶</Text>
          </Pressable>
        ) : null}

        {fullUrl && (msg.mediaType === 'IMAGE' || msg.mediaType === 'GIF') ? (
          <Image source={{ uri: fullUrl }} style={styles.mediaImg} resizeMode="cover" />
        ) : null}

        {fullUrl && msg.mediaType === 'VIDEO' ? (
          <Pressable focusable={true} onPress={() => Linking.openURL(fullUrl)} style={styles.mediaPill}>
            <Text style={styles.pillText}>▶️ Vidéo : {msg.fileName || 'Ouvrir la vidéo'}</Text>
          </Pressable>
        ) : null}

        {/* Lecture des vocaux DIRECTEMENT sur la page du forum (aucun nouvel onglet !) */}
        {fullUrl && msg.mediaType === 'AUDIO' ? (
          <InlineAudioPlayer audioUrl={fullUrl} fileName={msg.fileName} />
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
          {/* Système de vote / upvote */}
          <Pressable
            focusable={true}
            onPress={() => onVote?.(msg.id)}
            style={[styles.voteBtn, msg.hasVoted && styles.votedBtn]}
          >
            <Text style={[styles.voteTxt, msg.hasVoted && styles.votedTxt]}>
              👍 {(msg.voteCount ?? 0) > 0 ? msg.voteCount : ''}
            </Text>
          </Pressable>

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
  wrap: { marginBottom: 12, width: '100%', flexDirection: 'row' },
  wrapLeft: { justifyContent: 'flex-start' },
  wrapRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: Radius.md, padding: 10 },
  bubbleMe: { backgroundColor: '#4338ca', borderBottomRightRadius: 2 },
  bubbleOther: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    borderBottomLeftRadius: 2,
  },
  authorHeader: {
    marginBottom: 6,
    gap: 3,
  },
  author: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
  },
  authorLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    alignSelf: 'flex-start',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  authorLocationBadgeLive: {
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  authorLocationText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 220,
  },
  authorLocationJoin: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '800',
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#818cf8',
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 6,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  quoteAuthor: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
  quoteText: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' },
  quotedMediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    padding: 6,
    borderRadius: Radius.md,
    marginBottom: 6,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  quotedMediaPoster: { width: 36, height: 48, borderRadius: Radius.sm },
  quotedMediaPlaceholder: {
    width: 36,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotedMediaLabel: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
  quotedMediaTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  quotedMediaArrow: { color: '#818cf8', fontSize: 12, marginRight: 4 },
  mediaImg: { width: '100%', height: 180, borderRadius: Radius.sm, marginBottom: 6 },
  mediaPill: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: Radius.sm, marginBottom: 6 },
  pillText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  content: { color: '#ffffff', fontSize: 13, lineHeight: 18, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  voteBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  votedBtn: { backgroundColor: 'rgba(99, 102, 241, 0.35)' },
  voteTxt: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  votedTxt: { color: '#a5b4fc' },
  time: { color: '#cbd5e1', fontSize: 10, opacity: 0.8 },
  replyBtn: { paddingHorizontal: 4 },
  replyText: { color: '#93c5fd', fontSize: 12, fontWeight: 'bold' },
});
