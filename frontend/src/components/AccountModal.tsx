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
      <Pressable focusable={false} style={styles.overlay} onPress={onClose} {...({ dataSet: { modalBackdrop: 'true' } } as any)}>
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
                        ? 'Actif : vous regardez dans le lecteur sans apparaître sur /media ni dans les séances'
                        : 'Inactif : vos amis voient votre présence sur les médias'}
                    </Text>
                  </View>
                  <Pressable
                    focusable={true}
                    onPress={handleToggleIncognito}
                    style={[styles.incognitoToggle, isIncognito ? styles.incognitoOn : styles.incognitoOff]}
                  >
                    <Text style={styles.incognitoToggleTxt}>{isIncognito ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</Text>
                  </Pressable>
                </View>

                <View style={styles.permsRow}>
                  <Text style={[styles.permPill, { color: currentUser.canDownload ? '#34d399' : '#f87171' }]}>
                    📥 {currentUser.canDownload ? 'Téléchargement actif' : 'Téléchargement interdit'}
                  </Text>
                  <Text style={[styles.permPill, { color: currentUser.canWatchIptv ? '#38bdf8' : '#f87171' }]}>
                    📺 {currentUser.canWatchIptv ? 'IPTV autorisée' : 'IPTV interdite'}
                  </Text>
                </View>
              </View>

              <Pressable
                focusable={true}
                style={styles.userSpaceBtn}
                onPress={handleGoToUserSpace}
              >
                <Text style={styles.userSpaceBtnText}>🚀 Ouvrir Mon Espace Utilisateur (Stats, Amis, Favoris...)</Text>
              </Pressable>

              <Pressable
                focusable={true}
                style={styles.logoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.logoutBtnText}>Se déconnecter</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.notLoggedView}>
              <Text style={styles.notLoggedTxt}>Vous n'êtes pas connecté.</Text>
              <Pressable
                focusable={true}
                style={styles.loginBtn}
                onPress={handleGoToLogin}
              >
                <Text style={styles.loginBtnText}>Se connecter / Créer un compte</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
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
    gap: Spacing.two,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    color: '#ffffff',
    fontSize: 18,
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
    fontSize: 10,
    fontWeight: '800',
    color: '#fef08a',
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  memberBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93c5fd',
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  userEmail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  incognitoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: Radius.md,
    padding: 10,
    marginTop: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  incognitoTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '800' },
  incognitoDesc: { color: '#94a3b8', fontSize: 10, marginTop: 2, lineHeight: 14 },
  incognitoToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  incognitoOn: { backgroundColor: '#10b981' },
  incognitoOff: { backgroundColor: '#475569' },
  incognitoToggleTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  permsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.25)',
  },
  permPill: {
    fontSize: 11,
    fontWeight: '700',
  },
  userSpaceBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: Radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  userSpaceBtnText: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: '800',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: Radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  notLoggedView: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  notLoggedTxt: {
    color: '#94a3b8',
    marginBottom: 12,
    fontSize: 13,
  },
  loginBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Radius.pill,
  },
  loginBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
});
