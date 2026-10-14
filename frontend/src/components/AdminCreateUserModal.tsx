import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator } from 'react-native';
import { createAdminUser } from '@/services/adminApi';
import { styles } from './AccountModal.styles';
import { Radius } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AdminCreateUserModal({ visible, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return setErr('Le nom d’affichage est requis');
    setLoading(true);
    setErr('');

    const res = await createAdminUser({
      displayName: name.trim(),
      pin: pin.trim() || undefined,
      isAdmin,
    });
    setLoading(false);

    if (res.success) {
      setName(''); setPin(''); setIsAdmin(false);
      onCreated();
      onClose();
    } else {
      setErr(res.error || 'Erreur lors de la création');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { maxWidth: 420 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>👥 Nouveau Compte Utilisateur</Text>
            <Pressable focusable={true} style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></Pressable>
          </View>

          <TextInput style={styles.input} placeholder="Nom d’affichage (ex: Lucas)" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Code PIN (facultatif)" placeholderTextColor="#64748b" secureTextEntry keyboardType="numeric" maxLength={6} value={pin} onChangeText={setPin} />

          <Pressable
            focusable={true}
            onPress={() => setIsAdmin(!isAdmin)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: Radius.md, backgroundColor: isAdmin ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.6)', marginBottom: 12 }}
          >
            <Text style={{ fontSize: 16 }}>{isAdmin ? '👑' : '👤'}</Text>
            <Text style={{ color: isAdmin ? '#a5b4fc' : '#94a3b8', fontSize: 12, fontWeight: '700' }}>
              {isAdmin ? 'Droits Administrateur Activés' : 'Compte Membre Standard'}
            </Text>
          </Pressable>

          {err ? <Text style={styles.errorText}>{err}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable focusable={true} style={[styles.submitBtn, { flex: 1, backgroundColor: '#475569' }]} onPress={onClose}>
              <Text style={styles.submitText}>Annuler</Text>
            </Pressable>
            <Pressable focusable={true} style={[styles.submitBtn, { flex: 2 }]} onPress={handleCreate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Créer l'utilisateur</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
