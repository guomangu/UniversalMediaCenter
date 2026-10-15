import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { createAdminUser } from '@/services/adminApi';
import { Radius, Spacing } from '@/constants/theme';

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

  if (!visible) return null;

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
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.headerRow}>
            <Text style={modalStyles.title}>👤 Nouveau Compte Utilisateur</Text>
            <Pressable
              focusable={true}
              style={modalStyles.closeBtn}
              onPress={onClose}
            >
              <Text style={modalStyles.closeBtnTxt}>✕</Text>
            </Pressable>
          </View>

          {err ? (
            <View style={modalStyles.alertError}>
              <Text style={modalStyles.alertErrorTxt}>⚠️ {err}</Text>
            </View>
          ) : null}

          <View style={modalStyles.inputGroup}>
            <Text style={modalStyles.inputLabel}>Nom ou Pseudo *</Text>
            <TextInput
              ref={firstInputRef}
              style={modalStyles.textInput}
              placeholder="Ex : Lucas, Marie..."
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={modalStyles.inputGroup}>
            <Text style={modalStyles.inputLabel}>Adresse Email *</Text>
            <TextInput
              style={modalStyles.textInput}
              placeholder="lucas@famille.fr"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={modalStyles.inputGroup}>
            <Text style={modalStyles.inputLabel}>Mot de passe (optionnel)</Text>
            <TextInput
              style={modalStyles.textInput}
              placeholder="Au moins 6 caractères ou vide..."
              placeholderTextColor="#64748b"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              {...({
                autoComplete: 'new-password',
                name: 'create_user_new_password',
                id: 'create_user_new_password',
                'data-lpignore': 'true',
                'data-1p-ignore': 'true',
                'data-form-type': 'other',
              } as any)}
            />
          </View>

          <Pressable
            focusable={true}
            onPress={() => setIsAdmin(!isAdmin)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderRadius: Radius.md,
              backgroundColor: isAdmin ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              borderWidth: 1,
              borderColor: isAdmin ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 16 }}>{isAdmin ? '👑' : '👤'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 12 }}>
                Privilèges Administrateur
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 11 }}>
                {isAdmin ? 'Accès illimité à l’Agora, TV, réglages serveur et studio' : 'Utilisateur standard / profil famille'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            focusable={true}
            disabled={loading}
            onPress={handleCreate}
            style={[modalStyles.primaryBtn, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={modalStyles.primaryBtnTxt}>Créer le compte</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(29, 33, 39, 0.98)',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeBtnTxt: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  alertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  alertErrorTxt: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnTxt: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
