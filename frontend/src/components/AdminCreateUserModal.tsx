import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { createAdminUser } from '@/services/adminApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  profileTypes?: any[];
  onClose: () => void;
  onCreated: () => void;
}

export function AdminCreateUserModal({ visible, profileTypes = [], onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('MEMBRE');
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

  const isAdminSelected = selectedRole === 'ADMINISTRATEUR';

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
      profileRole: selectedRole,
      isAdmin: isAdminSelected,
    });
    setLoading(false);

    if (res.success) {
      setName(''); setEmail(''); setPassword(''); setSelectedRole('MEMBRE');
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

          {/* Sélecteur de type de profil / Pack */}
          <View style={modalStyles.inputGroup}>
            <Text style={modalStyles.inputLabel}>Pack / Type de Profil assigné</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(profileTypes.length > 0 ? profileTypes : [
                  { id: 'MEMBRE', label: 'Membre Standard' },
                  { id: 'ADMINISTRATEUR', label: 'Administrateur' },
                  { id: 'ENFANT', label: 'Enfant (Jeunesse)' },
                  { id: 'SAFEZONE', label: 'Safezone' },
                ]).map((pt) => {
                  const active = selectedRole === pt.id;
                  return (
                    <Pressable
                      key={pt.id}
                      focusable={true}
                      style={[
                        modalStyles.rolePill,
                        active && modalStyles.rolePillActive,
                      ]}
                      onPress={() => setSelectedRole(pt.id)}
                    >
                      <Text style={[modalStyles.rolePillTxt, active && modalStyles.rolePillTxtActive]}>
                        {pt.id === 'ADMINISTRATEUR' ? '👑 ' : pt.id === 'ENFANT' ? '🧒 ' : '👤 '}
                        {pt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

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
    maxWidth: 460,
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
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rolePillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  rolePillTxt: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  rolePillTxtActive: {
    color: '#c7d2fe',
    fontWeight: '800',
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
