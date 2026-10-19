import { StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  overlay: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    padding: Spacing.four,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' } : {}),
  },
  modal: {
    position: 'relative' as any,
    zIndex: 10,
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#131b2e',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    padding: Spacing.four,
    maxHeight: (Platform.OS === 'web' ? 'min(88vh, 680px)' : '88%') as any,
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'default' as any,
    ...(Platform.OS === 'web' ? { margin: 'auto' } : {}),
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 18px 45px rgba(0, 0, 0, 0.8)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 25 }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 6,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },

  // Notice info / warning
  infoBanner: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.5)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  infoBannerText: {
    color: '#c7d2fe',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  // Appareil actif connecté
  activeBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.5)',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 14,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  activeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stopBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  stopBtnTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  disconnectBtn: {
    backgroundColor: '#334155',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  disconnectBtnTxt: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },

  // Identité locale
  localBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  localInfo: {
    flex: 1,
    marginRight: 8,
  },
  localLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  localName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  localActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  localSyncBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  localSyncBadgeTxt: {
    fontSize: 10,
    fontWeight: '700',
  },
  localSyncBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  localSyncBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  editBtnTxt: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitleConnected: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 0.3,
  },
  sectionTitleDisconnected: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 14,
    fontStyle: 'italic',
  },

  // Carte appareil avec rangée d'actions
  deviceCardConnected: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(74, 222, 128, 0.4)',
  },
  deviceCardDisconnected: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  deviceCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deviceName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  deviceSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadgeOnline: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  statusBadgeOnlineTxt: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeOffline: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  statusBadgeOfflineTxt: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },

  // Les 5 boutons d'action par appareil : wrap responsive
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
    userSelect: 'none' as any,
  },
  actionBtnHover: {
    opacity: 0.85,
    transform: [{ scale: 1.02 }],
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    pointerEvents: 'none' as any,
  },

  // 1. Bouton "Déconnecter" (Rouge)
  btnDisconnect: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  btnDisconnectTxt: {
    color: '#f87171',
  },

  // 2. Bouton "Synchroniser" (Vert émeraude)
  btnSync: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(16, 185, 129, 0.6)',
  },
  btnSyncTxt: {
    color: '#34d399',
  },

  // 3. Bouton "Caster" (Indigo)
  btnCast: {
    backgroundColor: 'rgba(99, 102, 241, 0.28)',
    borderColor: 'rgba(99, 102, 241, 0.75)',
  },
  btnCastTxt: {
    color: '#a5b4fc',
  },

  // 4. Bouton "Suivre" (Cyan/Bleu ciel)
  btnFollow: {
    backgroundColor: 'rgba(6, 182, 212, 0.18)',
    borderColor: 'rgba(6, 182, 212, 0.6)',
  },
  btnFollowTxt: {
    color: '#22d3ee',
  },

  // 5. Bouton "Connecter" (Gris bleu ardoise)
  btnConnect: {
    backgroundColor: 'rgba(100, 116, 139, 0.25)',
    borderColor: 'rgba(148, 163, 184, 0.5)',
  },
  btnConnectTxt: {
    color: '#e2e8f0',
  },
});
