import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchTopicMessages,
  postTopicMessage,
  voteForumMessage,
  ForumMessage,
} from '@/services/forumApi';
import {
  fetchMediaSessions,
  joinSession,
  leaveSession,
  joinVoiceCall,
  leaveVoiceCall,
  getVoiceCallStatus,
  MediaSession,
} from '@/services/sessionApi';
import { useCurrentUser } from '@/services/authStore';
import { ForumMessageBubble } from './ForumMessageBubble';
import { ForumInputBar } from './ForumInputBar';
import { LiveVoiceRoomBar } from './LiveVoiceRoomBar';
import { ProposeSessionModal } from './ProposeSessionModal';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

interface Props {
  topicSlug: string;
  topicTitle: string;
  mediaId?: string;
  externalQuotedMedia?: { id: string; title: string; poster?: string } | null;
  onClearExternalQuote?: () => void;
}

export function MediaForumSection({
  topicSlug,
  topicTitle,
  mediaId,
  externalQuotedMedia,
  onClearExternalQuote,
}: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyMsg, setReplyMsg] = useState<ForumMessage | null>(null);
  const [quotedMedia, setQuotedMedia] = useState<{ id: string; title: string; poster?: string } | null>(null);

  // Séances & Live Voice Call
  const [sessions, setSessions] = useState<MediaSession[]>([]);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeTarget, setProposeTarget] = useState<{ id: string; title: string } | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callActiveCount, setCallActiveCount] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const pollTimerRef = useRef<any>(null);

  // Initialiser la citation externe si fournie
  useEffect(() => {
    if (externalQuotedMedia) {
      setQuotedMedia(externalQuotedMedia);
    }
  }, [externalQuotedMedia]);

  const loadData = useCallback(async () => {
    if (!topicSlug) return;
    try {
      const [msgs, callStatus] = await Promise.all([
        fetchTopicMessages(topicSlug),
        getVoiceCallStatus(topicSlug),
      ]);
      setMessages(msgs);
      setCallActiveCount(callStatus.activeCount || 0);

      if (mediaId) {
        const sRes = await fetchMediaSessions(mediaId);
        setSessions(sRes.sessions);
      }
    } catch (err) {
      console.warn('Erreur chargement forum:', err);
    } finally {
      setLoading(false);
    }
  }, [topicSlug, mediaId]);

  // Polling synchronisé / asynchrone toutes les 2.5 secondes
  useEffect(() => {
    loadData();
    pollTimerRef.current = setInterval(loadData, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadData]);

  const handleSendMessage = async (payload: {
    content: string;
    mediaType: string;
    mediaUrl?: string;
    fileName?: string;
    quotedMediaId?: string;
    quotedMediaTitle?: string;
    quotedMediaPoster?: string;
  }) => {
    if (!topicSlug) return;
    const myName = currentUser?.displayName || 'Visiteur';

    // Ajout optimiste immédiat dans la discussion
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ForumMessage = {
      id: tempId,
      topicSlug,
      topicTitle,
      authorId: currentUser?.id,
      authorName: myName,
      content: payload.content,
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl,
      fileName: payload.fileName,
      replyToId: replyMsg?.id,
      replyToText: replyMsg?.content,
      replyToAuthor: replyMsg?.authorName,
      quotedMediaId: payload.quotedMediaId,
      quotedMediaTitle: payload.quotedMediaTitle,
      quotedMediaPoster: payload.quotedMediaPoster,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyMsg(null);
    setQuotedMedia(null);
    onClearExternalQuote?.();

    try {
      await postTopicMessage(topicSlug, {
        topicTitle,
        content: payload.content,
        authorName: myName,
        authorId: currentUser?.id || undefined,
        mediaType: payload.mediaType,
        mediaUrl: payload.mediaUrl,
        fileName: payload.fileName,
        replyToId: replyMsg?.id,
        replyToText: replyMsg?.content,
        replyToAuthor: replyMsg?.authorName,
        quotedMediaId: payload.quotedMediaId,
        quotedMediaTitle: payload.quotedMediaTitle,
        quotedMediaPoster: payload.quotedMediaPoster,
      });
      await loadData();
    } catch (err) {
      console.error('Erreur publication message:', err);
    }
  };

  const handleVote = async (msgId: string) => {
    const res = await voteForumMessage(msgId);
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, voteCount: res.voteCount, hasVoted: res.hasVoted } : m))
      );
    }
  };

  const handleJoinSession = async (sess: MediaSession) => {
    await joinSession(sess.id);
    await loadData();
    router.push(`/player/${sess.nodeId}` as any);
  };

  const handleLeaveSession = async (sess: MediaSession) => {
    await leaveSession(sess.id);
    await loadData();
  };

  const handleToggleCall = async () => {
    if (inCall) {
      await leaveVoiceCall(topicSlug);
      setInCall(false);
    } else {
      await joinVoiceCall(topicSlug);
      setInCall(true);
    }
    loadData();
  };

  const myName = currentUser?.displayName || 'Moi';

  return (
    <View style={styles.container}>
      {/* En-tête Salle d'Attente & Forum */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View>
            <Text style={styles.headerTitle}>Salle d'attente & Discussion • {topicTitle}</Text>
            <Text style={styles.headerSub}>
              Proposez une séance, discutez en direct ou lancez un appel vocal continu
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Bouton d'Appel Vocal Direct (vocaux continus) */}
          <Pressable
            focusable={true}
            onPress={handleToggleCall}
            style={[styles.callBtn, inCall && styles.callBtnActive]}
          >
            <Text style={styles.callBtnTxt}>
              {inCall
                ? 'Quitter l\'appel'
                : callActiveCount > 0
                ? `Rejoindre l'appel (${callActiveCount})`
                : 'Appel direct'}
            </Text>
          </Pressable>

          {/* Bouton Proposer une séance */}
          <Pressable
            focusable={true}
            onPress={() => {
              setProposeTarget({ id: mediaId || topicSlug, title: topicTitle });
              setShowProposeModal(true);
            }}
            style={styles.proposeBtn}
          >
            <Text style={styles.proposeBtnTxt}>Proposer une séance</Text>
          </Pressable>
        </View>
      </View>

      {/* Barre d'appel vocal en direct si l'utilisateur est en appel ou si l'appel est actif */}
      {inCall ? (
        <LiveVoiceRoomBar
          topicSlug={topicSlug}
          topicTitle={topicTitle}
          onLeaveCall={() => {
            setInCall(false);
            loadData();
          }}
        />
      ) : null}

      {/* Liste des Séances actives ou proposées */}
      {sessions.length > 0 ? (
        <View style={styles.sessionsBox}>
          <Text style={styles.sessionsBoxTitle}>Séances en cours ou à venir ({sessions.length})</Text>
          <View style={styles.sessionsList}>
            {sessions.map((s) => {
              const isJoined = s.participants?.some((p) => p.userId === currentUser?.id);
              const pCount = s.participantCount || (s.participants?.length ?? 1);

              return (
                <View key={s.id} style={styles.sessionCard}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sessionCardTop}>
                      <Text style={styles.sessionBadgeTxt}>EN COURS</Text>
                      <Text style={styles.sessionHostTxt}>Initié par : {s.hostDisplayName}</Text>
                    </View>
                    <Text style={styles.sessionCardTitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.sessionParticipantsCount}>{pCount} spectateur{pCount > 1 ? 's' : ''}</Text>
                  </View>

                  <View style={styles.sessionActions}>
                    {isJoined ? (
                      <Pressable
                        focusable={true}
                        onPress={() => handleLeaveSession(s)}
                        style={styles.leaveBtn}
                      >
                        <Text style={styles.leaveBtnTxt}>Quitter</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        focusable={true}
                        onPress={() => handleJoinSession(s)}
                        style={styles.joinBtn}
                      >
                        <Text style={styles.joinBtnTxt}>Rejoindre</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Messages du Forum */}
      <View style={styles.messagesContainer}>
        {loading && messages.length === 0 ? (
          <ActivityIndicator color="#8e9ab0" style={{ marginVertical: 30 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyTxt}>
            Aucun message pour l'instant. Lancez la discussion ou proposez une séance !
          </Text>
        ) : (
          messages.map((m) => (
            <ForumMessageBubble
              key={m.id}
              msg={m}
              isMe={
                (currentUser?.id && m.authorId === currentUser.id) ||
                m.authorName === myName ||
                m.authorName === 'Moi'
              }
              onReply={(msg) => setReplyMsg(msg)}
              onVote={handleVote}
            />
          ))
        )}
      </View>

      {/* Barre de saisie multifonctionnelle (Texte, Vocal, Citations) */}
      <ForumInputBar
        replyMsg={replyMsg}
        quotedMedia={quotedMedia}
        onCancelReply={() => setReplyMsg(null)}
        onCancelQuote={() => {
          setQuotedMedia(null);
          onClearExternalQuote?.();
        }}
        onSend={handleSendMessage}
      />

      {/* Modale de proposition de séance */}
      {proposeTarget ? (
        <ProposeSessionModal
          visible={showProposeModal}
          nodeId={proposeTarget.id}
          defaultTitle={proposeTarget.title}
          topicSlug={topicSlug}
          onClose={() => {
            setShowProposeModal(false);
            setProposeTarget(null);
          }}
          onCreated={(sess) => {
            loadData();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(38, 44, 54, 0.65)',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    marginTop: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.three,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 },
  headerTitle: { color: '#edeef2', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { color: '#8a95a5', fontSize: 12, marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callBtn: {
    backgroundColor: '#3b6e5e',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  callBtnActive: {
    backgroundColor: 'rgba(168, 70, 70, 0.9)',
  },
  callBtnTxt: { color: '#edeef2', fontWeight: '700', fontSize: 11.5 },
  proposeBtn: {
    backgroundColor: '#475569',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  proposeBtnTxt: { color: '#edeef2', fontWeight: '700', fontSize: 11.5 },
  sessionsBox: {
    backgroundColor: 'rgba(35, 41, 51, 0.75)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
  },
  sessionsBoxTitle: { color: '#dfe4ec', fontSize: 13.5, fontWeight: '700', marginBottom: 8 },
  sessionsList: { gap: 8 },
  sessionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 36, 45, 0.7)',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.1)',
  },
  sessionCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sessionBadgeTxt: { color: '#d97777', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sessionHostTxt: { color: '#8a95a5', fontSize: 11 },
  sessionCardTitle: { color: '#dfe4ec', fontSize: 13, fontWeight: '600' },
  sessionParticipantsCount: { color: '#94a1b3', fontSize: 11, fontWeight: '500', marginTop: 2 },
  sessionActions: { marginLeft: 12 },
  joinBtn: {
    backgroundColor: '#3b705e',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  joinBtnTxt: { color: '#edeef2', fontSize: 11.5, fontWeight: '700' },
  leaveBtn: {
    backgroundColor: 'rgba(65, 75, 90, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  leaveBtnTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  messagesContainer: {
    minHeight: 120,
    marginBottom: Spacing.three,
  },
  emptyTxt: {
    color: '#7c8797',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 13,
  },
});
