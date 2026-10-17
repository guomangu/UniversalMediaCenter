import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentUser, logout } from '@/services/authStore';
import { toggleIncognitoMode } from '@/services/userApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AccountModal({ visible, onClose }: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const closeBtnRef = useRef<any>(null);
  const [isIncognito, setIsIncognito] = useState(currentUser?.isIncognito ?? false);

  useEffect(() => {
    if (currentUser) {
      setIsIncognito(currentUser.isIncognito ?? false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        closeBtnRef.current?.focus?.();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleToggleIncognito = async () => {
    const nextVal = !isIncognito;
    setIsIncognito(nextVal);
    await toggleIncognitoMode(nextVal);
  };

  const handleLogout = () => {
    logout();
    onClose();
    router.replace('/login');
  };

  const handleGoToLogin = () => {
    onClose();
    router.push('/login');
  };

  const handleGoToUserSpace = () => {
    onClose();
    router.push('/user');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          {...({ dataSet: { modalBackdrop: 'true' } } as any)}
        />
        <View style={styles.modalCard} {...({ dataSet: { modalContainer: 'true' } } as any)}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>👤 Mon Compte</Text>
            <Pressable
              ref={closeBtnRef}
              focusable={true}
              style={styles.closeBtn}
              onPress={onClose}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {currentUser ? (
            <View>
              <View style={styles.infoCard}>
                <View style={styles.userRow}>
                  <View style={[styles.avatar, { backgroundColor: currentUser.isAdmin ? '#4338ca' : '#334155' }]}>
                    <Text style={styles.avatarTxt}>
                      {currentUser.displayName ? currentUser.displayName.slice(0, 1).toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameBadges}>
                      <Text style={styles.userName}>{currentUser.displayName}</Text>
                      {currentUser.isAdmin ? (
                        <Text style={styles.adminBadge}>👑 Administrateur</Text>
                      ) : (
                        <Text style={styles.memberBadge}>👤 Membre</Text>
                      )}
                    </View>
                    <Text style={styles.userEmail}>{currentUser.email}</Text>
                  </View>
                </View>

                {/* Mode Discret activable depuis son compte */}
                <View style={styles.incognitoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.incognitoTitle}>🕶️ Mode Discret (Incognito)</Text>
                    <Text style={styles.incognitoDesc}>
                      {isIncognito
                        ? 'Actif : Vos lectures et présences ne sont pas partagées.'
                        : 'Désactivé : Vos amis peuvent voir votre activité.'}
                    </Text>
                  </View>
                  <Pressable
                    focusable={true}
                    style={[styles.incognitoBtn, isIncognito && styles.incognitoBtnActive]}
                    onPress={handleToggleIncognito}
                  >
                    <Text style={[styles.incognitoBtnTxt, isIncognito && styles.incognitoBtnTxtActive]}>
                      {isIncognito ? 'Désactiver' : 'Activer'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable focusable={true} style={styles.userSpaceBtn} onPress={handleGoToUserSpace}>
                  <Text style={styles.userSpaceBtnTxt}>📊 Mon Espace & Profil</Text>
                </Pressable>

                <Pressable focusable={true} style={styles.logoutBtn} onPress={handleLogout}>
                  <Text style={styles.logoutBtnTxt}>🚪 Se déconnecter</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.loggedOutBox}>
              <Text style={styles.loggedOutTxt}>Vous n'êtes actuellement pas connecté.</Text>
              <Pressable focusable={true} style={styles.loginBtn} onPress={handleGoToLogin}>
                <Text style={styles.loginBtnTxt}>Se connecter / Changer de compte</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1e293b',
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
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.three,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTxt: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  nameBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  adminBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  memberBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  incognitoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.3)',
  },
  incognitoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  incognitoDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  incognitoBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  incognitoBtnActive: {
    backgroundColor: '#6366f1',
  },
  incognitoBtnTxt: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  incognitoBtnTxtActive: {
    color: '#ffffff',
  },
  actions: {
    gap: 8,
  },
  userSpaceBtn: {
    backgroundColor: '#4338ca',
    paddingVertical: 12,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  userSpaceBtnTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 12,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  logoutBtnTxt: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 14,
  },
  loggedOutBox: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  loggedOutTxt: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: Spacing.three,
  },
  loginBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radius.lg,
  },
  loginBtnTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
