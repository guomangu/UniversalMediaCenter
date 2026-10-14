import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';
import { updateUserProfile } from '@/services/userApi';

const AVATAR_PRESETS = [
  '🍿', '🎬', '🚀', '👾', '🦊', '🐱', '🐼', '🦁', '⭐', '🔥', '🎧', '🎸'
];

interface Props {
  visible: boolean;
  currentUser: {
    displayName: string;
    bio?: string;
    avatarUrl?: string;
  };
  onClose: () => void;
  onSuccess: (updated: any) => void;
}

export function ProfileEditModal({ visible, currentUser, onClose, onSuccess }: Props) {
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatar, setAvatar] = useState(currentUser.avatarUrl || '🍿');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const firstInputRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        firstInputRef.current?.focus?.();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    const res = await updateUserProfile({
      displayName,
      bio,
      avatarUrl: avatar,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      onSuccess(res.user);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        focusable={false}
        style={styles.backdrop}
        onPress={onClose}
        {...({ dataSet: { modalBackdrop: 'true' } } as any)}
      >
        <View style={styles.card} {...({ dataSet: { modalContainer: 'true' } } as any)}>
          <View style={styles.header}>
            <Text style={styles.title}>✏️ Personnaliser mon profil</Text>
            <Pressable
              focusable={true}
              onPress={onClose}
              style={styles.closeBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          {/* Choix de l'avatar */}
          <Text style={styles.label}>Avatar :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>
            {AVATAR_PRESETS.map((emoji) => (
              <Pressable
                key={emoji}
                focusable={true}
                onPress={() => setAvatar(emoji)}
                style={[styles.avatarBtn, avatar === emoji && styles.avatarBtnActive]}>
                <Text style={styles.avatarEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Pseudo */}
          <Text style={styles.label}>Nom d'affichage ou Pseudo :</Text>
          <TextInput
            ref={firstInputRef}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ex: Alex"
            placeholderTextColor="#64748b"
            style={styles.input}
          />

          {/* Bio / Statut */}
          <Text style={styles.label}>Bio / Statut ciné-série :</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Ex: Fan inconditionnel d'animation japonaise & SF 🚀"
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={2}
            style={[styles.input, { minHeight: 60 }]}
          />

          {error ? <Text style={styles.errorTxt}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              focusable={true}
              onPress={onClose}
              style={styles.cancelBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.cancelTxt}>Annuler</Text>
            </Pressable>
            <Pressable focusable={true} onPress={handleSave} disabled={loading} style={styles.saveBtn}>
              <Text style={styles.saveTxt}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 4 },
  closeTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: '#cbd5e1', marginBottom: 6 },
  avatarRow: { gap: 8, paddingVertical: 6, marginBottom: 14 },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarBtnActive: { borderColor: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  avatarEmoji: { fontSize: 22 },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 14,
  },
  errorTxt: { color: '#f87171', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: '#334155' },
  cancelTxt: { color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: '#6366f1' },
  saveTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
});
