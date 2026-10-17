import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import {
  fetchFriends,
  sendFriendRequest,
  acceptFriend,
  rejectFriend,
  searchUsers,
} from '@/services/friendApi';

export function UserFriendsTab() {
  const router = useRouter();
  const [friendsData, setFriendsData] = useState<{ friends: any[]; pendingReceived: any[]; pendingSent: any[] }>({
    friends: [],
    pendingReceived: [],
    pendingSent: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadData = () => {
    fetchFriends()
      .then(setFriendsData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      setSearchLoading(true);
      searchUsers(q)
        .then(setSearchResults)
        .finally(() => setSearchLoading(false));
    } else {
      setSearchResults([]);
    }
  };

  const handleSendReq = async (targetUserId?: string, targetEmail?: string) => {
    setFeedback('');
    const res = await sendFriendRequest({ targetUserId, targetEmail });
    if (res.error) {
      setFeedback(`⚠️ ${res.error}`);
    } else {
      setFeedback('✨ Demande envoyée avec succès !');
      loadData();
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery).then(setSearchResults);
      }
      setTimeout(() => setFeedback(''), 4000);
    }
  };

  const handleAccept = async (id: string) => {
    await acceptFriend(id);
    loadData();
  };

  const handleReject = async (id: string) => {
    await rejectFriend(id);
    loadData();
    if (searchQuery.trim().length >= 2) {
      searchUsers(searchQuery).then(setSearchResults);
    }
  };

  if (loading && friendsData.friends.length === 0) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#818cf8" size="small" />
        <Text style={styles.loadingTxt}>Synchronisation de vos amis...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Demandes reçues */}
      {friendsData.pendingReceived.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.secTitle}>🔔 Demandes en attente ({friendsData.pendingReceived.length})</Text>
          <View style={{ gap: 8 }}>
            {friendsData.pendingReceived.map((req) => (
              <View key={req.friendshipId} style={styles.rowCard}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarEmoji}>{req.avatarUrl || '👤'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{req.displayName}</Text>
                  <Text style={styles.sub}>{req.email}</Text>
                </View>
                <Pressable
                  focusable={true}
                  onPress={() => handleAccept(req.friendshipId)}
                  style={styles.acceptBtn}
                >
                  <Text style={styles.btnTxt}>✓ Accepter</Text>
                </Pressable>
                <Pressable
                  focusable={true}
                  onPress={() => handleReject(req.friendshipId)}
                  style={styles.rejectBtn}
                >
                  <Text style={styles.btnTxt}>✕ Refuser</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 2. Demandes envoyées en attente */}
      {friendsData.pendingSent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.secTitle}>⏳ Vos invitations envoyées ({friendsData.pendingSent.length})</Text>
          <View style={{ gap: 8 }}>
            {friendsData.pendingSent.map((req) => (
              <View key={req.friendshipId} style={styles.rowCard}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarEmoji}>{req.avatarUrl || '👤'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{req.displayName}</Text>
                  <Text style={styles.sub}>En attente de réponse</Text>
                </View>
                <Pressable
                  focusable={true}
                  onPress={() => handleReject(req.friendshipId)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnTxt}>Annuler l'invitation</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. Trouver & Ajouter un ami */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>➕ Trouver & Inviter des amis</Text>
        <TextInput
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Rechercher par nom de membre ou adresse e-mail..."
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        {searchLoading && <ActivityIndicator color="#818cf8" size="small" style={{ marginTop: 8 }} />}

        {searchResults.length > 0 && (
          <View style={styles.resultsBox}>
            {searchResults.map((u) => {
              const isFriend = u.relationshipStatus === 'FRIEND';
              const isSent = u.relationshipStatus === 'PENDING_SENT';
              const isRecv = u.relationshipStatus === 'PENDING_RECEIVED';

              return (
                <View key={u.id} style={styles.rowCard}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarEmoji}>{u.avatarUrl || '👤'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{u.displayName}</Text>
                    <Text style={styles.sub}>{u.email}</Text>
                  </View>

                  {isFriend ? (
                    <View style={styles.statusPillFriend}>
                      <Text style={styles.statusPillFriendTxt}>✓ Déjà ami</Text>
                    </View>
                  ) : isSent ? (
                    <View style={styles.statusPillPending}>
                      <Text style={styles.statusPillPendingTxt}>Invitation envoyée</Text>
                    </View>
                  ) : isRecv ? (
                    <Pressable
                      focusable={true}
                      onPress={() => u.friendshipId && handleAccept(u.friendshipId)}
                      style={styles.acceptBtn}
                    >
                      <Text style={styles.btnTxt}>✓ Accepter l'invitation</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      focusable={true}
                      onPress={() => handleSendReq(u.id)}
                      style={styles.acceptBtn}
                    >
                      <Text style={styles.btnTxt}>+ Ajouter en ami</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 4. Liste des amis */}
      <View style={styles.section}>
        <View style={styles.secHeader}>
          <Text style={styles.secTitle}>👥 Mes Amis ({friendsData.friends.length})</Text>
          <Pressable focusable={true} onPress={loadData} style={styles.refreshPill}>
            <Text style={styles.refreshPillTxt}>↻ Actualiser</Text>
          </Pressable>
        </View>

        {friendsData.friends.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>Vous n'avez pas encore d'amis connectés</Text>
            <Text style={styles.emptyDesc}>
              Utilisez la recherche ci-dessus pour inviter des amis, partager vos salons de visionnage et échanger en privé !
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {friendsData.friends.map((f) => (
              <View key={f.friendshipId} style={styles.friendCard}>
                <View style={styles.friendHeader}>
                  <View style={styles.avatarWrapLarge}>
                    <Text style={styles.avatarEmojiLarge}>{f.avatarUrl || '👤'}</Text>
                    <View
                      style={[
                        styles.onlineDot,
                        { backgroundColor: f.isOnline ? '#22c55e' : '#64748b' },
                      ]}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.name}>{f.displayName}</Text>
                      <Text style={[styles.presenceTxt, { color: f.isOnline ? '#4ade80' : '#94a3b8' }]}>
                        {f.isOnline ? 'En ligne' : 'Hors ligne'}
                      </Text>
                    </View>
                    {f.bio ? <Text style={styles.bio} numberOfLines={1}>{f.bio}</Text> : null}

                    {/* Activité en direct si l'ami regarde un média */}
                    {f.currentActivity?.isWatching ? (
                      <View style={styles.activityBadge}>
                        <Pressable
                          focusable={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Rejoindre le visionnage de ${f.displayName}`}
                          onPress={() => {
                            if (!f.currentActivity?.mediaId) return;
                            router.push({
                              pathname: '/player/[id]',
                              params: {
                                id: f.currentActivity.mediaId,
                                joinTime: String(Math.floor(f.currentActivity.positionSeconds || 0)),
                                targetUser: f.displayName,
                              },
                            } as any);
                          }}
                          style={styles.activityPressable}
                        >
                          <Text style={styles.activityTxt}>
                            🍿 Regarde : <Text style={styles.activityTitle}>{f.currentActivity.title}</Text>
                          </Text>
                          {f.currentActivity.positionSeconds && f.currentActivity.positionSeconds > 0 ? (
                            <Text style={styles.activityTimestamp}>
                              ({Math.floor(f.currentActivity.positionSeconds / 60)}:{String(Math.floor(f.currentActivity.positionSeconds % 60)).padStart(2, '0')})
                            </Text>
                          ) : null}
                        </Pressable>
                        {f.currentActivity.mediaId ? (
                          <Pressable
                            focusable={true}
                            accessibilityRole="button"
                            accessibilityLabel={`Rejoindre le visionnage de ${f.displayName}`}
                            onPress={() =>
                              router.push({
                                pathname: '/player/[id]',
                                params: {
                                  id: f.currentActivity.mediaId,
                                  joinTime: String(Math.floor(f.currentActivity.positionSeconds || 0)),
                                  targetUser: f.displayName,
                                },
                              } as any)
                            }
                            style={styles.joinWatchBtn}
                          >
                            <Text style={styles.joinWatchTxt}>Rejoindre ▶</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Barre d'actions rapides */}
                <View style={styles.actionRow}>
                  <Pressable
                    focusable={true}
                    onPress={() =>
                      router.push({
                        pathname: '/forum/[topic]',
                        params: {
                          topic: f.dmTopicSlug || `dm-${f.userId}`,
                          title: `💬 Discussion avec ${f.displayName}`,
                        },
                      } as any)
                    }
                    style={styles.chatBtn}
                  >
                    <Text style={styles.chatBtnTxt}>💬 Discuter</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() =>
                      router.push({
                        pathname: '/forum/[topic]',
                        params: {
                          topic: f.privateTopicSlug || `private-user-${f.userId}`,
                          title: `🔒 Salon de ${f.displayName}`,
                        },
                      } as any)
                    }
                    style={styles.spaceBtn}
                  >
                    <Text style={styles.spaceBtnTxt}>🔒 Espace</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => handleReject(f.friendshipId)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnTxt}>Retirer</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  loadingBox: { padding: 30, alignItems: 'center', gap: 10 },
  loadingTxt: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic' },
  section: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  secHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  secTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshPill: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  refreshPillTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  friendCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
    gap: 10,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(51, 65, 85, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  avatarEmoji: { fontSize: 20 },
  avatarEmojiLarge: { fontSize: 24 },
  name: { color: '#f1f5f9', fontWeight: '800', fontSize: 14 },
  sub: { color: '#94a3b8', fontSize: 11 },
  presenceTxt: { fontSize: 11, fontWeight: '700' },
  bio: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic', marginTop: 1 },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  activityPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
    cursor: 'pointer' as any,
  },
  activityTimestamp: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    marginLeft: 2,
  },
  activityTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '600' },
  activityTitle: { color: '#ffffff', fontWeight: '800' },
  joinWatchBtn: {
    backgroundColor: '#6366f1',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  joinWatchTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.25)',
    paddingTop: 8,
  },
  chatBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  chatBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
  spaceBtn: {
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  spaceBtnTxt: { color: '#cbd5e1', fontWeight: '700', fontSize: 11 },
  removeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  removeBtnTxt: { color: '#f87171', fontWeight: '700', fontSize: 11 },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
  },
  feedback: { color: '#38bdf8', fontSize: 12, marginTop: 6, fontWeight: '700' },
  resultsBox: { marginTop: 10, gap: 6 },
  acceptBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  rejectBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  cancelBtn: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  cancelBtnTxt: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  btnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
  statusPillFriend: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  statusPillFriendTxt: { color: '#4ade80', fontSize: 11, fontWeight: '700' },
  statusPillPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  statusPillPendingTxt: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { color: '#f1f5f9', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  emptyDesc: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 380 },
});
