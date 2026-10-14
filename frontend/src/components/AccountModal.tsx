import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentUser, logout } from '@/services/authStore';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AccountModal({ visible, onClose }: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const handleLogout = () => {
    logout();
    onClose();
    router.replace('/login');
  };

  const handleGoToLogin = () => {
    onClose();
    router.push('/login');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>👤 Mon Compte</Text>
            <Pressable focusable={true} style={styles.closeBtn} onPress={onClose}>
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

                <View style={styles.permsRow}>
                  <Text style={[styles.permPill, { color: currentUser.canDownload ? '#34d399' : '#f87171' }]}>
                    📥 {currentUser.canDownload ? 'Téléchargement actif' : 'Téléchargement interdit'}
                  </Text>
                  <Text style={[styles.permPill, { color: currentUser.canWatchIptv ? '#38bdf8' : '#f87171' }]}>
                    📺 {currentUser.canWatchIptv ? 'IPTV autorisée' : 'IPTV interdite'}
                  </Text>
                  <Text style={[styles.permPill, { color: '#fbbf24' }]}>
                    🔞 {currentUser.maxCsaAgeLimit ? `CSA : -${currentUser.maxCsaAgeLimit} ans` : 'CSA : Tout public'}
                  </Text>
                </View>
              </View>

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
        </Pressable>
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
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
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
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
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
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 16,
  },
  adminBadge: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  memberBadge: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  userEmail: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  permsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  permPill: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 14,
  },
  notLoggedView: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: 12,
  },
  notLoggedTxt: {
    color: '#94a3b8',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: '#6366f1',
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
  },
  loginBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
