import React, { useState } from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ForumMessage } from '@/services/forumApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { resolveImageUrl } from '@/services/api';
import { InlineAudioPlayer } from './InlineAudioPlayer';
import { InlineVideoPlayer } from './InlineVideoPlayer';
import { ForumMediaModal } from './ForumMediaModal';
import { Radius } from '@/constants/theme';

interface Props {
  msg: ForumMessage;
  isMe: boolean;
  onReply: (m: ForumMessage) => void;
  onVote?: (msgId: string) => void;
}

export function ForumMessageBubble({ msg, isMe, onReply, onVote }: Props) {
  const router = useRouter();
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'VIDEO' | 'IMAGE' | 'GIF' | 'DOCUMENT'>('IMAGE');

  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullUrl = msg.mediaUrl
    ? msg.mediaUrl.startsWith('http')
      ? msg.mediaUrl
      : `${getApiBaseUrl()}${msg.mediaUrl}`
    : undefined;

  const quotedPosterUri = msg.quotedMediaPoster ? resolveImageUrl(msg.quotedMediaPoster) : null;

  // Détection des doublons : si l'auteur a déjà un badge de localisation/séance avec le bouton intelligent "Rejoindre ➔",
  // ou si la citation d'œuvre pointe vers la même œuvre, on évite le doublon et on garde le lien intelligent !
  const isDuplicateOfAuthorLocation = Boolean(
    msg.authorLocation &&
    msg.quotedMediaId &&
    (
      msg.authorLocation.mediaId === msg.quotedMediaId ||
      msg.authorLocation.path?.includes(msg.quotedMediaId) ||
      (msg.quotedMediaTitle && msg.authorLocation.title?.toLowerCase().includes(msg.quotedMediaTitle.toLowerCase())) ||
      (msg.authorLocation.title && msg.quotedMediaTitle?.toLowerCase().includes(msg.authorLocation.title.toLowerCase()))
    )
  );

  const shouldShowQuotedMedia = Boolean(msg.quotedMediaId && !isDuplicateOfAuthorLocation);

  const openModal = (type: 'VIDEO' | 'IMAGE' | 'GIF' | 'DOCUMENT') => {
    setModalType(type);
    setMediaModalVisible(true);
  };

  return (
    <View style={[styles.wrap, isMe ? styles.wrapRight : styles.wrapLeft]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {/* Entête de l'auteur avec sa dernière page / média connu sous son nom */}
        <View style={styles.authorHeader}>
          <Text style={styles.author}>{msg.authorName}</Text>

          {/* Lien média le plus intelligent avec bouton d'action "Rejoindre ➔" */}
          {msg.authorLocation ? (
            <Pressable
              focusable={true}
              onPress={() => {
                const targetPath = msg.authorLocation!.path;
                const targetMediaId = msg.authorLocation!.mediaId || (targetPath.startsWith('/player/') ? targetPath.replace('/player/', '') : null);
                if (targetMediaId) {
                  router.push({
                    pathname: '/player/[id]',
                    params: {
                      id: targetMediaId,
                      joinTime: String(Math.floor(msg.authorLocation!.positionSeconds || 0)),
                      targetUser: msg.authorName,
                    },
                  } as any);
                } else {
                  router.push(targetPath as any);
                }
              }}
              style={[
                styles.authorLocationBadge,
                msg.authorLocation.isLive && styles.authorLocationBadgeLive,
              ]}
            >
              <Text style={styles.authorLocationText} numberOfLines={1}>
                {msg.authorLocation.isLive ? 'En séance : ' : 'Position : '}
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

        {/* Citation d'une œuvre (affichée uniquement si non dupliquée avec la localisation/séance de l'auteur) */}
        {shouldShowQuotedMedia ? (
          <Pressable
            focusable={true}
            onPress={() => router.push(`/media/${msg.quotedMediaId}` as any)}
            style={styles.quotedMediaCard}
          >
            {quotedPosterUri ? (
              <Image source={{ uri: quotedPosterUri }} style={styles.quotedMediaPoster} />
            ) : (
              <View style={styles.quotedMediaPlaceholder}>
                <Text style={styles.quotedMediaPlaceholderTxt}>M</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.quotedMediaTitle} numberOfLines={1}>
                {msg.quotedMediaTitle || 'Média'}
              </Text>
            </View>
            <Text style={styles.quotedMediaJoin}>Rejoindre ➔</Text>
          </Pressable>
        ) : null}

        {/* Images et GIFs : clic ouvre la modale d'affichage en grand */}
        {fullUrl && (msg.mediaType === 'IMAGE' || msg.mediaType === 'GIF') ? (
          <Pressable
            focusable={true}
            onPress={() => openModal(msg.mediaType as any)}
            style={styles.mediaImgPressable}
          >
            <Image source={{ uri: fullUrl }} style={styles.mediaImg} resizeMode="cover" />
            <View style={styles.mediaZoomBadge}>
              <Text style={styles.mediaZoomTxt}>Agrandir</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Vidéos : lecture automatique en boucle (muet) + clic ouvre en grand avec le son dans une popup */}
        {fullUrl && msg.mediaType === 'VIDEO' ? (
          <InlineVideoPlayer
            videoUrl={fullUrl}
            fileName={msg.fileName}
            onOpenModal={() => openModal('VIDEO')}
          />
        ) : null}

        {/* Lecture des messages vocaux in-place sans rupture de navigation */}
        {fullUrl && msg.mediaType === 'AUDIO' ? (
          <InlineAudioPlayer audioUrl={fullUrl} fileName={msg.fileName} />
        ) : null}

        {/* Documents et fichiers : clic ouvre la popup avec détails et actions propres */}
        {fullUrl && msg.mediaType === 'DOCUMENT' ? (
          <Pressable
            focusable={true}
            onPress={() => openModal('DOCUMENT')}
            style={styles.mediaPill}
          >
            <Text style={styles.pillText}>Document : {msg.fileName || 'Voir le document'}</Text>
          </Pressable>
        ) : null}

        {fullUrl && msg.mediaType === 'LINK' ? (
          <Pressable focusable={true} onPress={() => Linking.openURL(fullUrl)} style={styles.mediaPill}>
            <Text style={[styles.pillText, { color: '#94a1b3' }]}>Lien : {msg.mediaUrl}</Text>
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
              +1 {(msg.voteCount ?? 0) > 0 ? msg.voteCount : ''}
            </Text>
          </Pressable>

          <Text style={styles.time}>{time}</Text>

          <Pressable focusable={true} onPress={() => onReply(msg)} style={styles.replyBtn}>
            <Text style={styles.replyText}>↩</Text>
          </Pressable>
        </View>
      </View>

      {/* Popup de prévisualisation grand format avec son et contrôles */}
      {fullUrl && (
        <ForumMediaModal
          visible={mediaModalVisible}
          onClose={() => setMediaModalVisible(false)}
          mediaType={modalType}
          mediaUrl={fullUrl}
          fileName={msg.fileName}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12, width: '100%', flexDirection: 'row' },
  wrapLeft: { justifyContent: 'flex-start' },
  wrapRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: Radius.md, padding: 10 },
  bubbleMe: { backgroundColor: '#384352', borderBottomRightRadius: 2 },
  bubbleOther: {
    backgroundColor: 'rgba(38, 44, 54, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
    borderBottomLeftRadius: 2,
  },
  authorHeader: {
    marginBottom: 6,
    gap: 3,
  },
  author: {
    color: '#b0bccb',
    fontSize: 11,
    fontWeight: '700',
  },
  authorLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 36, 45, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.15)',
    alignSelf: 'flex-start',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  authorLocationBadgeLive: {
    backgroundColor: 'rgba(168, 70, 70, 0.25)',
    borderColor: 'rgba(168, 70, 70, 0.5)',
  },
  authorLocationText: {
    color: '#dfe4ec',
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 220,
  },
  authorLocationJoin: {
    color: '#94a1b3',
    fontSize: 10,
    fontWeight: '700',
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#7c8797',
    backgroundColor: 'rgba(25, 30, 38, 0.4)',
    padding: 6,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  quoteAuthor: { color: '#c5cedb', fontSize: 11, fontWeight: '600' },
  quoteText: { color: '#9ba7b7', fontSize: 11, fontStyle: 'italic' },
  quotedMediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 36, 45, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
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
    backgroundColor: 'rgba(45, 52, 64, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotedMediaPlaceholderTxt: { color: '#7c8797', fontSize: 11, fontWeight: '700' },
  quotedMediaTitle: { color: '#dfe4ec', fontSize: 12, fontWeight: '600' },
  quotedMediaJoin: { color: '#94a1b3', fontSize: 10.5, fontWeight: '700', marginRight: 4 },
  mediaImgPressable: {
    position: 'relative',
    marginBottom: 6,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  mediaImg: { width: '100%', height: 180, borderRadius: Radius.sm },
  mediaZoomBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(26, 31, 40, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mediaZoomTxt: {
    color: '#dfe4ec',
    fontSize: 10,
    fontWeight: '600',
  },
  mediaPill: {
    backgroundColor: 'rgba(25, 30, 38, 0.5)',
    padding: 8,
    borderRadius: Radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.1)',
  },
  pillText: { color: '#cbd5e1', fontSize: 11 },
  content: { color: '#edeef2', fontSize: 13, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  voteBtn: {
    backgroundColor: 'rgba(45, 52, 64, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  votedBtn: { backgroundColor: 'rgba(70, 85, 105, 0.5)' },
  voteTxt: { color: '#8a95a5', fontSize: 10, fontWeight: '600' },
  votedTxt: { color: '#edeef2' },
  time: { color: '#7c8797', fontSize: 9.5 },
  replyBtn: { padding: 2 },
  replyText: { color: '#8a95a5', fontSize: 12 },
});
