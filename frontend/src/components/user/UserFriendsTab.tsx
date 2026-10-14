import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [feedback, setFeedback] = useState('');

  const loadData = () => {
    fetchFriends().then(setFriendsData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      searchUsers(q).then(setSearchResults);
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
      setFeedback('✅ Demande envoyée !');
      loadData();
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleAccept = async (id: string) => {
    await acceptFriend(id);
    loadData();
  };

  const handleReject = async (id: string) => {
    await rejectFriend(id);
    loadData();
  };

  return (
    <View style={styles.container}>
      {/* 1. Demandes reçues */}
      {friendsData.pendingReceived.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.secTitle}>🔔 Demandes en attente ({friendsData.pendingReceived.length})</Text>
          <View style={{ gap: 8 }}>
            {friendsData.pendingReceived.map((req) => (
              <View key={req.friendshipId} style={styles.rowCard}>
                <Text style={styles.avatarEmoji}>{req.avatarUrl || '👤'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{req.displayName}</Text>
                  <Text style={styles.sub}>{req.email}</Text>
                </View>
                <Pressable onPress={() => handleAccept(req.friendshipId)} style={styles.acceptBtn}>
                  <Text style={styles.btnTxt}>✓ Accepter</Text>
                </Pressable>
                <Pressable onPress={() => handleReject(req.friendshipId)} style={styles.rejectBtn}>
                  <Text style={styles.btnTxt}>✕ Refuser</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 2. Ajouter un ami */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>➕ Trouver & Ajouter un ami</Text>
        <TextInput
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Rechercher par nom ou adresse e-mail..."
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        {searchResults.length > 0 && (
          <View style={styles.resultsBox}>
            {searchResults.map((u) => (
              <View key={u.id} style={styles.rowCard}>
                <Text style={styles.avatarEmoji}>{u.avatarUrl || '👤'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{u.displayName}</Text>
                  <Text style={styles.sub}>{u.email}</Text>
                </View>
                <Pressable onPress={() => handleSendReq(u.id)} style={styles.acceptBtn}>
                  <Text style={styles.btnTxt}>+ Demander en ami</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 3. Liste des amis */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>👥 Mes Amis ({friendsData.friends.length})</Text>
        {friendsData.friends.length === 0 ? (
          <Text style={styles.emptyTxt}>Vous n'avez pas encore d'amis ajoutés. Utilisez la recherche ci-dessus !</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {friendsData.friends.map((f) => (
              <View key={f.friendshipId} style={styles.rowCard}>
                <Text style={styles.avatarEmoji}>{f.avatarUrl || '🍿'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{f.displayName}</Text>
                  {f.bio ? <Text style={styles.bio} numberOfLines={1}>{f.bio}</Text> : null}
                </View>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/forum/[topic]',
                      params: {
                        topic: f.privateTopicSlug,
                        title: `🔒 Salon Privé de ${f.displayName}`,
                      },
                    } as any)
                  }
                  style={styles.forumBtn}>
                  <Text style={styles.btnTxt}>🔒 Salon Privé</Text>
                </Pressable>
                <Pressable onPress={() => handleReject(f.friendshipId)} style={styles.rejectBtn}>
                  <Text style={styles.btnTxt}>Retirer</Text>
                </Pressable>
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
  section: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 18,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  secTitle: { fontSize: 14, fontWeight: '800', color: '#818cf8', marginBottom: 12, textTransform: 'uppercase' },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  avatarEmoji: { fontSize: 24 },
  name: { color: '#f1f5f9', fontWeight: '700', fontSize: 13 },
  sub: { color: '#94a3b8', fontSize: 11 },
  bio: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
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
  acceptBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill },
  rejectBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill },
  forumBtn: { backgroundColor: '#0284c7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill },
  btnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
  emptyTxt: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic' },
});
