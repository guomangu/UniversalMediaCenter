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
        <Pressable
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          {...({ dataSet: { modalBackdrop: 'true' } } as any)}
        />
        <View style={modalStyles.card} {...({ dataSet: { modalContainer: 'true' } } as any)}>
          <View style={modalStyles.headerRow}>
            <Text style={modalStyles.title}>👤 Nouveau Compte Utilisateur</Text>
            <Pressable
              focusable={true}
              style={modalStyles.closeBtn}
              onPress={onClose}
              {...({ dataSet: { modalClose: 'true' } } as any)}
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
              placeholder="lucas@example.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={modalStyles.inputGroup}>
            <Text style={modalStyles.inputLabel}>Mot de passe (optionnel)</Text>
            <TextInput
              style={modalStyles.textInput}
              placeholder="Au moins 6 caractères"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Sélecteur de type de profil */}
          <View style={modalStyles.inputGroup}>
            <Text style={modalStyles.inputLabel}>Pack / Type de Profil assigné</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={modalStyles.roleList}>
              {['MEMBRE', 'ENFANT', 'ADOLESCENT', 'INVITE', 'ADMINISTRATEUR'].map((role) => {
                const active = selectedRole === role;
                return (
                  <Pressable
                    key={role}
                    focusable={true}
                    onPress={() => setSelectedRole(role)}
                    style={[
                      modalStyles.rolePill,
                      active && modalStyles.rolePillActive,
                    ]}
                  >
                    <Text style={[modalStyles.rolePillTxt, active && modalStyles.rolePillTxtActive]}>
                      {role === 'ADMINISTRATEUR' ? '👑 Admin' : role}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Pressable
            focusable={true}
            onPress={handleCreate}
            disabled={loading}
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
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 6 },
  closeBtnTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  alertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: Spacing.two,
  },
  alertErrorTxt: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  inputGroup: { marginBottom: Spacing.three },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#cbd5e1', marginBottom: 6 },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    padding: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  roleList: { gap: 8, paddingVertical: 4 },
  rolePill: {
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  rolePillActive: { backgroundColor: '#6366f1', borderColor: '#818cf8' },
  rolePillTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  rolePillTxtActive: { color: '#ffffff' },
  primaryBtn: {
    backgroundColor: '#6366f1',
    borderRadius: Radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
});
