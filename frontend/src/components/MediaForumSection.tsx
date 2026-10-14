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
  MediaSession,
} from '@/services/sessionApi';
import { useCurrentUser } from '@/services/authStore';
import { ForumMessageBubble } from './ForumMessageBubble';
import { ForumInputBar } from './ForumInputBar';
import { LiveVoiceRoomBar } from './LiveVoiceRoomBar';
import { ProposeSessionModal } from './ProposeSessionModal';
import { UserRatingModal } from './UserRatingModal';
import { Radius, Spacing, MaxContentWidth } from '@/constants/theme';

interface Props {
  topicSlug: string;
  topicTitle: string;
  mediaId?: string;
  childItems?: Array<{ id: string; title: string; posterPath?: string }>;
  externalQuotedMedia?: { id: string; title: string; poster?: string } | null;
  onClearExternalQuote?: () => void;
}

export function MediaForumSection({
  topicSlug,
  topicTitle,
  mediaId,
  childItems = [],
  externalQuotedMedia,
  onClearExternalQuote,
}: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyMsg, setReplyMsg] = useState<ForumMessage | null>(null);
  const [quotedMedia, setQuotedMedia] = useState<{ id: string; title: string; poster?: string } | null>(null);
  
  // Séances & Live Voice
  const [sessions, setSessions] = useState<MediaSession[]>([]);
  const [activeSession, setActiveSession] = useState<MediaSession | null>(null);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeTarget, setProposeTarget] = useState<{ id: string; title: string } | null>(null);

  // Évaluation du gérant / utilisateur
  const [rateModalTarget, setRateModalTarget] = useState<{ id: string; name: string } | null>(null);

  // Visibilité pour chargement asynchrone toutes les 3 secondes
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<any>(null);
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
      const msgs = await fetchTopicMessages(topicSlug);
      setMessages(msgs);
      if (mediaId) {
        const sRes = await fetchMediaSessions(mediaId);
        setSessions(sRes.sessions);
        if (sRes.sessions.length > 0 && !activeSession) {
          setActiveSession(sRes.sessions[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [topicSlug, mediaId, activeSession]);

  // Observer de visibilité (IntersectionObserver pour rafraîchissement 3s quand l'utilisateur regarde à proximité)
  useEffect(() => {
    loadData();

    if (Platform.OS === 'web' && typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            setIsVisible(entry.isIntersecting);
          });
        },
        { rootMargin: '200px' }
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [topicSlug, mediaId, loadData]);

  // Polling asynchrone toutes les 3 secondes si à proximité
  useEffect(() => {
    if (!isVisible) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(() => {
      loadData();
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isVisible, loadData]);

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
    setReplyMsg(null);
    setQuotedMedia(null);
    onClearExternalQuote?.();
    await loadData();
    scrollRef.current?.scrollToEnd({ animated: true });
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
    setActiveSession(sess);
    await loadData();
    // Naviguer vers le lecteur
    router.push(`/player/${sess.nodeId}` as any);
  };

  const handleLeaveSession = async (sess: MediaSession) => {
    await leaveSession(sess.id);
    if (activeSession?.id === sess.id) setActiveSession(null);
    await loadData();
  };

  const myName = currentUser?.displayName || 'Moi';

  return (
    <View ref={containerRef} style={styles.container}>
      {/* En-tête Salle d'Attente & Forum */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>💬</Text>
          <View>
            <Text style={styles.headerTitle}>Salle d'attente & Forum #{topicTitle}</Text>
            <Text style={styles.headerSub}>
              Proposez une séance, votez, discutez en direct ou en vocal différé
            </Text>
          </View>
        </View>

        <Pressable
          focusable={true}
          onPress={() => {
            setProposeTarget({ id: mediaId || topicSlug, title: topicTitle });
            setShowProposeModal(true);
          }}
          style={styles.proposeBtn}
        >
          <Text style={styles.proposeBtnTxt}>🍿 Proposer une séance</Text>
        </Pressable>
      </View>

      {/* Barre d'appel vocal en direct si une séance active existe */}
      {activeSession ? (
        <LiveVoiceRoomBar
          sessionId={activeSession.id}
          sessionTitle={activeSession.title}
          hostUserId={activeSession.hostUserId}
          hostDisplayName={activeSession.hostDisplayName}
          isHost={currentUser?.id === activeSession.hostUserId}
          onRateHost={(hId, hName) => setRateModalTarget({ id: hId, name: hName })}
        />
      ) : null}

      {/* Liste des Séances actives ou proposées */}
      {sessions.length > 0 ? (
        <View style={styles.sessionsBox}>
          <Text style={styles.sessionsBoxTitle}>🍿 Séances en cours ou à venir ({sessions.length})</Text>
          <View style={styles.sessionsList}>
            {sessions.map((s) => {
              const isJoined = s.participants?.some((p) => p.userId === currentUser?.id);
              const pCount = s.participantCount || (s.participants?.length ?? 1);

              return (
                <View key={s.id} style={styles.sessionCard}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sessionCardTop}>
                      <Text style={styles.sessionBadgeTxt}>🔴 EN COURS</Text>
                      <Text style={styles.sessionHostTxt}>Gérant : {s.hostDisplayName}</Text>
                    </View>
                    <Text style={styles.sessionCardTitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.sessionParticipantsCount}>👥 {pCount} spectateur{pCount > 1 ? 's' : ''}</Text>
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
                        <Text style={styles.joinBtnTxt}>Rejoindre ▶</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Sélecteur de citation d'enfants de la page (ex: Épisodes / Saisons) */}
      {childItems.length > 0 ? (
        <View style={styles.childQuoteRow}>
          <Text style={styles.childQuoteLabel}>Citer un épisode pour la séance :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {childItems.slice(0, 8).map((child) => (
              <Pressable
                key={child.id}
                focusable={true}
                onPress={() => setQuotedMedia({ id: child.id, title: child.title, poster: child.posterPath })}
                style={styles.childQuoteBtn}
              >
                <Text style={styles.childQuoteTxt} numberOfLines={1}>+ {child.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Messages du Forum */}
      <View style={styles.messagesContainer}>
        {loading && messages.length === 0 ? (
          <ActivityIndicator color="#6366f1" style={{ marginVertical: 30 }} />
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
              onRateAuthor={(aId, aName) => setRateModalTarget({ id: aId, name: aName })}
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
            setActiveSession(sess);
            loadData();
          }}
        />
      ) : null}

      {/* Modale de notation du gérant / utilisateur */}
      {rateModalTarget ? (
        <UserRatingModal
          visible={true}
          targetUserId={rateModalTarget.id}
          targetUserName={rateModalTarget.name}
          onClose={() => setRateModalTarget(null)}
          onRated={loadData}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    marginTop: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
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
  headerIcon: { fontSize: 26 },
  headerTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  headerSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  proposeBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  proposeBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  sessionsBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  sessionsBoxTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  sessionsList: { gap: 8 },
  sessionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  sessionCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sessionBadgeTxt: { color: '#ef4444', fontSize: 10, fontWeight: '900' },
  sessionHostTxt: { color: '#94a3b8', fontSize: 11 },
  sessionCardTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  sessionParticipantsCount: { color: '#a5b4fc', fontSize: 11, fontWeight: '600', marginTop: 2 },
  sessionActions: { marginLeft: 12 },
  joinBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  joinBtnTxt: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  leaveBtn: {
    backgroundColor: 'rgba(71, 85, 105, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  leaveBtnTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  childQuoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.three,
    paddingVertical: 4,
  },
  childQuoteLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  childQuoteBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  childQuoteTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '600' },
  messagesContainer: {
    maxHeight: 380,
    minHeight: 120,
    paddingVertical: 6,
    marginBottom: 8,
  },
  emptyTxt: { color: '#64748b', textAlign: 'center', marginVertical: 30, fontStyle: 'italic', fontSize: 13 },
});
