import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import { ProfileEditModal } from './ProfileEditModal';
import { toggleIncognitoMode } from '@/services/userApi';

interface Props {
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    bio?: string;
    isAdmin?: boolean;
    isIncognito?: boolean;
  };
  onProfileUpdated: (updated: any) => void;
}

export function UserProfileCard({ user, onProfileUpdated }: Props) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [isIncognito, setIsIncognito] = useState(user.isIncognito ?? false);
  const privateTopic = `private-user-${user.id}`;

  const handleToggleIncognito = async () => {
    const nextVal = !isIncognito;
    setIsIncognito(nextVal);
    await toggleIncognitoMode(nextVal);
    onProfileUpdated({ ...user, isIncognito: nextVal });
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarTxt}>{user.avatarUrl || '🍿'}</Text>
        </View>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.displayName}</Text>
            {user.isAdmin ? (
              <View style={styles.adminBadge}>
                <Text style={styles.adminTxt}>ADMIN</Text>
              </View>
            ) : null}
            {isIncognito ? (
              <View style={styles.incognitoBadge}>
                <Text style={styles.incognitoBadgeTxt}>🕶️ MODE DISCRET</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.email}>{user.email}</Text>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          focusable={true}
          onPress={() =>
            router.push({
              pathname: '/forum/[topic]',
              params: {
                topic: privateTopic,
                title: `🔒 Salon Privé de ${user.displayName}`,
              },
            } as any)
          }
          style={styles.privateForumBtn}>
          <Text style={styles.privateForumTxt}>🔒 Mon Salon Privé (Amis Uniquement)</Text>
        </Pressable>

        <Pressable
          focusable={true}
          onPress={handleToggleIncognito}
          style={[styles.incognitoBtn, isIncognito ? styles.incognitoActive : styles.incognitoInactive]}
        >
          <Text style={styles.incognitoBtnTxt}>
            {isIncognito ? '🕶️ Mode Discret : ACTIF' : '👁️ Mode Discret : DÉSACTIVÉ'}
          </Text>
        </Pressable>

        <Pressable
          focusable={true}
          onPress={() => setShowEdit(true)}
          style={styles.editBtn}>
          <Text style={styles.editTxt}>✏️ Modifier</Text>
        </Pressable>
      </View>

      <ProfileEditModal
        visible={showEdit}
        currentUser={user}
        onClose={() => setShowEdit(false)}
        onSuccess={onProfileUpdated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    marginBottom: 20,
  },
  topRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#818cf8',
  },
  avatarTxt: { fontSize: 32 },
  identity: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 20, fontWeight: '900', color: '#f8fafc' },
  adminBadge: {
    backgroundColor: '#818cf8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  adminTxt: { color: '#0f172a', fontSize: 10, fontWeight: '800' },
  incognitoBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  incognitoBadgeTxt: { color: '#34d399', fontSize: 10, fontWeight: '800' },
  email: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  bio: { color: '#cbd5e1', fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  privateForumBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  privateForumTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  incognitoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  incognitoActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  incognitoInactive: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  incognitoBtnTxt: { color: '#f8fafc', fontWeight: '800', fontSize: 12 },
  editBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  editTxt: { color: '#f1f5f9', fontWeight: '700', fontSize: 12 },
});
