import React, { useState, useEffect, useRef } from 'react';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const firstInputRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        firstInputRef.current?.focus?.();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleCreate = async () => {
    if (!name.trim()) return setErr('Le nom d’affichage est requis');
    if (!email.trim() || !email.includes('@')) return setErr('Une adresse email valide est requise');
    if (password && password.length < 6) return setErr('Le mot de passe doit faire au moins 6 caractères');

    setLoading(true);
    setErr('');

    const res = await createAdminUser({
      displayName: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim() || undefined,
      isAdmin,
    });
    setLoading(false);

    if (res.success) {
      setName(''); setEmail(''); setPassword(''); setIsAdmin(false);
      onCreated();
      onClose();
    } else {
      setErr(res.error || 'Erreur lors de la création');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[styles.modalCard, { maxWidth: 420 }]}
          {...({ dataSet: { modalContainer: 'true' } } as any)}
        >
          <View style={styles.headerRow}>
            <Text style={styles.title}>👤 Nouveau Compte Utilisateur</Text>
            <Pressable
              focusable={true}
              style={styles.closeBtn}
              onPress={onClose}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            ref={firstInputRef}
            style={styles.input}
            placeholder="Nom d’affichage (ex: Lucas)"
            placeholderTextColor="#64748b"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email (ex: lucas@domaine.com)"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe (au moins 6 car.)"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            focusable={true}
            onPress={() => setIsAdmin(!isAdmin)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: Radius.md,
              backgroundColor: isAdmin ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 16 }}>{isAdmin ? '👑' : '👤'}</Text>
            <Text style={{ color: isAdmin ? '#a5b4fc' : '#94a3b8', fontSize: 12, fontWeight: '700' }}>
              {isAdmin ? 'Droits Administrateur Activés' : 'Compte Membre Standard'}
            </Text>
          </Pressable>

          {err ? <Text style={styles.errorText}>{err}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              focusable={true}
              style={[styles.submitBtn, { flex: 1, backgroundColor: '#475569' }]}
              onPress={onClose}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.submitText}>Annuler</Text>
            </Pressable>
            <Pressable
              focusable={true}
              style={[styles.submitBtn, { flex: 2 }]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Créer le compte</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
