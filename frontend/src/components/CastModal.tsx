import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchCastDevices,
  sendCastCommand,
  getLocalDeviceId,
  getLocalDeviceName,
  setLocalDeviceName,
  registerAsReceiver,
  triggerNativeCast,
  resolveLanStreamUrl,
  CastDevice,
  CastMediaPayload,
} from '@/services/castService';
import {
  fetchUserDevices,
  sendDeviceCommand,
  setDeviceSyncGroup,
  disconnectRemoteDevice,
  UserConnectedDevice,
} from '@/services/userDeviceService';
import {
  getRealDeviceDisplayName,
  getLocalSyncGroupId,
  setLocalSyncGroupId,
} from '@/services/deviceIdentity';
import { useActiveCastTarget, setActiveCastTarget, disconnectCastTotally } from '@/services/castState';
import { playerStore } from '@/services/playerStore';
import { getVideoStreamUrl } from '@/services/api';
import { styles } from './CastModal.styles';

interface CastModalProps {
  visible: boolean;
  onClose: () => void;
  currentMedia?: CastMediaPayload;
  onTargetSelected?: (target: CastDevice) => void;
  onCastStarted?: () => void;
}

export const CastModal: React.FC<CastModalProps> = ({
  visible,
  onClose,
  currentMedia,
  onTargetSelected,
  onCastStarted,
}) => {
  const router = useRouter();
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [accountDevices, setAccountDevices] = useState<UserConnectedDevice[]>([]);
  const [myDeviceName, setMyDeviceName] = useState(getLocalDeviceName());
  const [localSyncGroup, setLocalSyncGroup] = useState(getLocalSyncGroupId());
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const localId = getLocalDeviceId();
  const activeCastTarget = useActiveCastTarget();

  // Détermine si un identifiant correspond à l'appareil local actuel
  const isThisDevice = (id: string, isCurrent?: boolean) => {
    if (isCurrent) return true;
    if (!id) return false;
    return id === localId || id.startsWith(localId + '_') || localId.startsWith(id + '_');
  };

  const refresh = async () => {
    try {
      const [userDevRes, castDevList] = await Promise.all([
        fetchUserDevices().catch(() => ({ devices: [], currentDeviceId: localId })),
        fetchCastDevices().catch(() => []),
      ]);

      // 1. Filtrer et dédupliquer les appareils du compte
      const rawAccount = (userDevRes.devices || []).filter(
        (x) => !isThisDevice(x.deviceId, x.isCurrentDevice)
      );

      const accountMap = new Map<string, UserConnectedDevice>();
      for (const d of rawAccount) {
        const existing = accountMap.get(d.deviceId);
        if (!existing || d.lastSeenAt > existing.lastSeenAt) {
          accountMap.set(d.deviceId, d);
        }
      }
      const filteredAccount = Array.from(accountMap.values());
      setAccountDevices(filteredAccount);

      // 2. Dédupliquer les récepteurs Cast
      const accountIds = new Set(filteredAccount.map((a) => a.deviceId));
      const accountNames = new Set(
        filteredAccount.map((a) => (a.customName || a.name || '').trim().toLowerCase())
      );

      const filteredCast = (castDevList || []).filter((c: CastDevice) => {
        if (isThisDevice(c.id)) return false;
        if (accountIds.has(c.id)) return false;
        if (c.name && accountNames.has(c.name.trim().toLowerCase())) return false;
        return true;
      });

      const castMap = new Map<string, CastDevice>();
      for (const c of filteredCast) {
        castMap.set(c.id, c);
      }
      setDevices(Array.from(castMap.values()));
    } catch {}
  };

  useEffect(() => {
    if (!visible) {
      setFeedbackNotice(null);
      return;
    }
    setMyDeviceName(getLocalDeviceName());
    setLocalSyncGroup(getLocalSyncGroupId());
    refresh();
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [visible, localId]);

  useEffect(() => {
    if (feedbackNotice) {
      const timer = setTimeout(() => setFeedbackNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackNotice]);

  if (!visible) return null;

  const handleRename = () => {
    const next = Platform.OS === 'web' ? window.prompt('Nom de cet appareil :', myDeviceName) : null;
    if (next?.trim()) {
      setLocalDeviceName(next.trim());
      setMyDeviceName(next.trim());
      registerAsReceiver(next.trim(), {});
    }
  };

  // Bascule de synchronisation pour l'appareil local
  const handleToggleLocalSync = async () => {
    const isCurrentlyStandalone = localSyncGroup === 'standalone';
    const nextGroup = isCurrentlyStandalone ? 'default' : 'standalone';
    setLocalSyncGroupId(nextGroup);
    setLocalSyncGroup(nextGroup);
    await setDeviceSyncGroup(localId, nextGroup);
    setFeedbackNotice(
      isCurrentlyStandalone
        ? 'Cet appareil est maintenant en synchronisation.'
        : 'Cet appareil est maintenant indépendant (hors synchronisation).'
    );
  };

  // Helper pour extraire la position de lecture temps réel la plus fraîche
  const getLivePosition = (): number => {
    if (typeof window !== 'undefined') {
      const v = (document.querySelector('video[data-player-div-video="true"]') ||
        document.querySelector('video[data-video-player="true"]')) as HTMLVideoElement | null;
      if (v && Number.isFinite(v.currentTime) && v.currentTime > 0) {
        return Math.floor(v.currentTime);
      }
    }
    const storePos = playerStore.getState().activeMedia?.positionSeconds;
    if (typeof storePos === 'number' && storePos > 0) {
      return Math.floor(storePos);
    }
    return currentMedia?.positionSeconds || 0;
  };

  // Helper pour créer l'adaptateur Cast d'un appareil de compte
  const buildCastAdapter = (dev: UserConnectedDevice): CastDevice => {
    const real = getRealDeviceDisplayName(dev);
    const livePos = getLivePosition();
    return {
      id: dev.deviceId,
      name: real.title,
      deviceType: (dev.deviceType as any) || 'BROWSER',
      currentMediaId: currentMedia?.id || dev.currentPlayback?.mediaId,
      mediaTitle: currentMedia?.title || dev.currentPlayback?.mediaTitle,
      posterUrl: currentMedia?.posterUrl || dev.currentPlayback?.posterUrl,
      positionSeconds: livePos > 0 ? livePos : (dev.currentPlayback?.positionSeconds || 0),
      durationSeconds: dev.currentPlayback?.durationSeconds || 0,
      isPlaying: dev.currentPlayback?.isPlaying ?? false,
      volume: dev.currentPlayback?.volume ?? 1,
      isMuted: dev.currentPlayback?.isMuted ?? false,
      subtitleTrack: currentMedia?.activeSubtitle || dev.currentPlayback?.activeSubtitle || "off",
      audioTrack: currentMedia?.activeAudio || dev.currentPlayback?.activeAudio || "auto",
    };
  };

  // =========================================================================
  // LES 5 ACTIONS DISPONIBLES PAR APPAREIL DU COMPTE
  // =========================================================================

  // 1. DÉCONNECTER (Déconnecter l'appareil à distance)
  const handleDisconnectAccountDevice = async (dev: UserConnectedDevice) => {
    const real = getRealDeviceDisplayName(dev);
    setFeedbackNotice(`Déconnexion de ${real.title}...`);
    await disconnectRemoteDevice(dev.deviceId);
    await setDeviceSyncGroup(dev.deviceId, 'standalone');
    setAccountDevices((prev) =>
      prev.map((d) => (d.deviceId === dev.deviceId ? { ...d, syncGroupId: 'standalone', isOnline: false } : d))
    );
    if (activeCastTarget?.id === dev.deviceId) {
      await disconnectCastTotally(false);
    }
    setFeedbackNotice(`${real.title} a été déconnecté.`);
  };

  // 2. SYNCHRONISER (Rejoindre le groupe de synchronisation par défaut)
  const handleSyncAccountDevice = async (dev: UserConnectedDevice) => {
    const real = getRealDeviceDisplayName(dev);
    // Alignement de l'appareil distant et local sur 'default'
    setLocalSyncGroupId('default');
    setLocalSyncGroup('default');
    await setDeviceSyncGroup(localId, 'default');
    await setDeviceSyncGroup(dev.deviceId, 'default');

    const livePos = getLivePosition();

    if (currentMedia) {
      await sendDeviceCommand(dev.deviceId, 'LOAD_MEDIA', {
        mediaId: currentMedia.id,
        title: currentMedia.title,
        streamUrl: currentMedia.streamUrl,
        posterUrl: currentMedia.posterUrl,
        positionSeconds: livePos,
        syncGroupId: 'default',
        activeSubtitle: currentMedia.activeSubtitle || 'off',
        activeAudio: currentMedia.activeAudio || 'auto',
      });
    }

    setAccountDevices((prev) =>
      prev.map((d) => (d.deviceId === dev.deviceId ? { ...d, syncGroupId: 'default' } : d))
    );
    setFeedbackNotice(`${real.title} est maintenant synchronisé avec cet appareil.`);
  };

  // 3. CASTER (Diffuser le média en cours sur cet écran)
  const handleCastToAccountDevice = async (dev: UserConnectedDevice) => {
    const real = getRealDeviceDisplayName(dev);
    if (!currentMedia) {
      setFeedbackNotice(`Aucun média en cours à diffuser sur ${real.title}.`);
      return;
    }

    const livePos = getLivePosition();

    await sendDeviceCommand(dev.deviceId, 'LOAD_MEDIA', {
      mediaId: currentMedia.id,
      title: currentMedia.title,
      streamUrl: currentMedia.streamUrl,
      posterUrl: currentMedia.posterUrl,
      positionSeconds: livePos,
      syncGroupId: 'default',
      activeSubtitle: currentMedia.activeSubtitle || 'off',
      activeAudio: currentMedia.activeAudio || 'auto',
    });

    const castAdapter = buildCastAdapter(dev);
    castAdapter.isPlaying = true;
    castAdapter.positionSeconds = livePos;
    castAdapter.subtitleTrack = currentMedia.activeSubtitle || 'off';
    castAdapter.audioTrack = currentMedia.activeAudio || 'auto';
    setActiveCastTarget(castAdapter);
    onCastStarted?.();
    setFeedbackNotice(`Diffusion lancée sur ${real.title}.`);
  };

  // 4. SUIVRE (Suivre la lecture en cours de cet appareil sur notre écran local)
  const handleFollowAccountDevice = async (dev: UserConnectedDevice) => {
    const real = getRealDeviceDisplayName(dev);
    const pb = dev.currentPlayback;
    if (!pb || !pb.mediaId) {
      setFeedbackNotice(`${real.title} n'a aucune lecture active à suivre.`);
      return;
    }

    playerStore.openMedia({
      id: pb.mediaId,
      title: pb.mediaTitle || 'Média en cours',
      posterUrl: pb.posterUrl || `/api/media/${pb.mediaId}/poster`,
      streamUrl: pb.streamUrl || getVideoStreamUrl(pb.mediaId),
      isLive: Boolean(pb.isLive),
      activeAudio: pb.activeAudio || 'auto',
      activeSubtitle: pb.activeSubtitle || 'off',
      initialTime: pb.positionSeconds || 0,
      isRemoteSync: true,
      expand: true,
    });

    setLocalSyncGroupId('default');
    setLocalSyncGroup('default');
    setFeedbackNotice(`Vous suivez la lecture de ${real.title}.`);
    onClose();
  };

  // 5. CONNECTER (Connecter cet appareil comme télécommande active)
  const handleConnectAccountDevice = async (dev: UserConnectedDevice) => {
    const real = getRealDeviceDisplayName(dev);
    const castAdapter = buildCastAdapter(dev);
    setActiveCastTarget(castAdapter);
    onTargetSelected?.(castAdapter);
    setFeedbackNotice(`Télécommande connectée à ${real.title}.`);
  };

  // =========================================================================
  // LES 5 ACTIONS DISPONIBLES POUR LES RÉCEPTEURS CAST / SMART TV
  // =========================================================================

  const handleDisconnectCastDevice = async (device: CastDevice) => {
    setFeedbackNotice(`${device.name} déconnecté.`);
    await sendCastCommand(device.id, 'STOP').catch(() => {});
    await disconnectCastTotally(false);
    setDevices((prev) =>
      prev.map((x) => (x.id === device.id ? { ...x, isPlaying: false } : x))
    );
  };

  const handleSyncCastDevice = async (device: CastDevice) => {
    setLocalSyncGroupId('default');
    setLocalSyncGroup('default');
    const livePos = getLivePosition();
    if (currentMedia) {
      const lanUrl = await resolveLanStreamUrl(currentMedia.streamUrl, currentMedia.id);
      await sendCastCommand(device.id, 'LOAD', {
        mediaId: currentMedia.id,
        title: currentMedia.title,
        streamUrl: lanUrl,
        positionSeconds: livePos,
        activeSubtitle: currentMedia.activeSubtitle || 'off',
        activeAudio: currentMedia.activeAudio || 'auto',
      });
      if (currentMedia.activeSubtitle && currentMedia.activeSubtitle !== 'off') {
        sendCastCommand(device.id, 'SET_SUBTITLE', { subtitle: currentMedia.activeSubtitle });
      }
      onCastStarted?.();
    }
    setActiveCastTarget({ ...device, isPlaying: true, positionSeconds: livePos });
    setFeedbackNotice(`${device.name} synchronisé.`);
  };

  const handleCastToCastDevice = async (device: CastDevice) => {
    if (!currentMedia) {
      setFeedbackNotice(`Aucun média en cours à diffuser sur ${device.name}.`);
      return;
    }
    const livePos = getLivePosition();
    const lanUrl = await resolveLanStreamUrl(currentMedia.streamUrl, currentMedia.id);
    await sendCastCommand(device.id, 'LOAD', {
      mediaId: currentMedia.id,
      title: currentMedia.title,
      streamUrl: lanUrl,
      positionSeconds: livePos,
      activeSubtitle: currentMedia.activeSubtitle || 'off',
      activeAudio: currentMedia.activeAudio || 'auto',
    });
    setActiveCastTarget({ ...device, isPlaying: true, positionSeconds: livePos });
    onCastStarted?.();
    setFeedbackNotice(`Diffusion lancée sur ${device.name}.`);
  };

  const handleFollowCastDevice = async (device: CastDevice) => {
    if (!device.isPlaying || !device.currentMediaId) {
      setFeedbackNotice(`${device.name} n'a aucune lecture active à suivre.`);
      return;
    }
    playerStore.openMedia({
      id: device.currentMediaId,
      title: device.mediaTitle || 'Média en cours',
      posterUrl: device.posterUrl || `/api/media/${device.currentMediaId}/poster`,
      streamUrl: getVideoStreamUrl(device.currentMediaId),
      isLive: false,
      activeAudio: device.audioTrack || 'auto',
      activeSubtitle: device.subtitleTrack || 'off',
      initialTime: device.positionSeconds || 0,
      isRemoteSync: true,
      expand: true,
    });
    setLocalSyncGroupId('default');
    setLocalSyncGroup('default');
    setFeedbackNotice(`Vous suivez la lecture de ${device.name}.`);
    onClose();
  };

  const handleConnectCastDevice = async (device: CastDevice) => {
    setActiveCastTarget(device);
    onTargetSelected?.(device);
    setFeedbackNotice(`Connecté à ${device.name}.`);
  };

  const handleNativeCast = async () => {
    setFeedbackNotice(null);
    const livePos = getLivePosition();
    const mediaWithPos = currentMedia ? { ...currentMedia, positionSeconds: livePos } : undefined;
    const result = await triggerNativeCast(mediaWithPos);
    if (result.success) {
      // La session Google Cast doit devenir la cible active de la télécommande :
      // sans cela, le lecteur local restait affiché et les contrôles pilotaient
      // le navigateur au lieu du Chromecast.
      if (result.device) {
        setActiveCastTarget(result.device);
      }
      onCastStarted?.();
      onClose();
    } else {
      setFeedbackNotice(
        result.message || 'Aucun récepteur Cast trouvé sur ce réseau local. Allumez votre TV ou Chromecast et réessayez.'
      );
    }
  };

  const handleStopActiveCast = async () => {
    await disconnectCastTotally(true);
    onClose();
  };

  const handleGoToManageDevices = () => {
    onClose();
    router.push({ pathname: '/user', params: { tab: 'DEVICES' } } as any);
  };

  // Séparation précise des écrans connectés et déconnectés
  const connectedAccountDevices = accountDevices.filter((d) => d.isOnline && d.syncGroupId !== 'standalone');
  const disconnectedAccountDevices = accountDevices.filter((d) => !d.isOnline || d.syncGroupId === 'standalone');

  const connectedCastDevices = devices.filter((d) => activeCastTarget?.id === d.id || Boolean(d.isPlaying));
  const disconnectedCastDevices = devices.filter((d) => activeCastTarget?.id !== d.id && !d.isPlaying);

  const isNativeCastActive = Boolean(
    activeCastTarget &&
      (activeCastTarget.deviceType === 'CHROMECAST' ||
        activeCastTarget.deviceType === 'TV' ||
        activeCastTarget.id === 'google_cast_target' ||
        activeCastTarget.id === 'native_tv_cast')
  );

  const hasDiscoveredTv =
    isNativeCastActive ||
    devices.some((c) => c.deviceType === 'TV' || c.deviceType === 'CHROMECAST' || /TV|Chromecast/i.test(c.name)) ||
    accountDevices.some((a) => a.deviceType === 'TV' || a.deviceType === 'CHROMECAST' || /TV|Chromecast/i.test(a.name));

  const totalConnectedCount =
    connectedAccountDevices.length + connectedCastDevices.length + (isNativeCastActive ? 1 : 0);
  const totalDisconnectedCount =
    disconnectedAccountDevices.length +
    disconnectedCastDevices.length +
    (!hasDiscoveredTv ? 1 : 0);

  const isLocalInSync = localSyncGroup !== 'standalone';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        focusable={false}
        tabIndex={-1}
        onPress={(e) => {
          if (Platform.OS === 'web') {
            if (e.target === e.currentTarget) {
              onClose();
            }
          } else {
            onClose();
          }
        }}
      >
        <View
          style={styles.modal}
          onStartShouldSetResponder={() => true}
          {...({ dataSet: { modalContainer: 'true' } } as any)}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📡 Diffuser & Télécommande</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.closeText} pointerEvents="none">✕</Text>
            </Pressable>
          </View>

          {/* Bannière de notification / message d'information */}
          {feedbackNotice && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>ℹ️ {feedbackNotice}</Text>
            </View>
          )}

          {/* Appareil actuellement casté / contrôlé */}
          {activeCastTarget && (
            <View style={styles.activeBox}>
              <View style={styles.activeHeader}>
                <Text style={styles.activeTitle}>Diffusion en cours</Text>
                <Text style={styles.activeName}>📺 {activeCastTarget.name}</Text>
              </View>
              <View style={styles.activeActions}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.stopBtn}
                  onPress={handleStopActiveCast}
                >
                  <Text style={styles.stopBtnTxt} pointerEvents="none">⏹ Arrêter la lecture TV</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.disconnectBtn}
                  onPress={() => disconnectCastTotally(false)}
                >
                  <Text style={styles.disconnectBtnTxt} pointerEvents="none">Déconnecter</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Identité locale */}
          <View style={styles.localBox}>
            <View style={styles.localInfo}>
              <Text style={styles.localLabel}>Cet appareil :</Text>
              <Text style={styles.localName} numberOfLines={1}>{myDeviceName}</Text>
              <View
                style={[
                  styles.localSyncBadge,
                  { backgroundColor: isLocalInSync ? 'rgba(74, 222, 128, 0.2)' : 'rgba(148, 163, 184, 0.15)' },
                ]}
              >
                <Text
                  style={[
                    styles.localSyncBadgeTxt,
                    { color: isLocalInSync ? '#4ade80' : '#94a3b8' },
                  ]}
                  pointerEvents="none"
                >
                  {isLocalInSync ? '🟢 Synchronisé' : '⚪ Mode indépendant'}
                </Text>
              </View>
            </View>
            <View style={styles.localActions}>
              <Pressable
                accessibilityRole="button"
                style={[
                  styles.localSyncBtn,
                  {
                    backgroundColor: isLocalInSync ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.25)',
                    borderColor: isLocalInSync ? 'rgba(239, 68, 68, 0.5)' : 'rgba(99, 102, 241, 0.6)',
                  },
                ]}
                onPress={handleToggleLocalSync}
              >
                <Text
                  style={[
                    styles.localSyncBtnTxt,
                    { color: isLocalInSync ? '#f87171' : '#a5b4fc' },
                  ]}
                  pointerEvents="none"
                >
                  {isLocalInSync ? 'Désynchroniser' : 'Synchroniser'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.editBtn}
                onPress={handleRename}
              >
                <Text style={styles.editBtnTxt} pointerEvents="none">✏️ Renommer</Text>
              </Pressable>
            </View>
          </View>

          {/* Liste des appareils avec les 5 boutons par appareil */}
          <ScrollView style={{ maxHeight: 420, flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {/* ========================================================= */}
            {/* SECTION 1 : ÉCRANS CONNECTÉS                             */}
            {/* ========================================================= */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleConnected}>
                🟢 Mes écrans connectés ({totalConnectedCount})
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleGoToManageDevices}
              >
                <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '700' }} pointerEvents="none">
                  Gérer ⚙️
                </Text>
              </Pressable>
            </View>

            {totalConnectedCount === 0 ? (
              <Text style={styles.emptyText}>Aucun autre écran actuellement connecté.</Text>
            ) : (
              <>
                {/* 1. Appareils de compte connectés */}
                {connectedAccountDevices.map((dev) => {
                  const real = getRealDeviceDisplayName(dev);
                  return (
                    <View key={dev.deviceId} style={styles.deviceCardConnected}>
                      <View style={styles.deviceCardTop}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.deviceName} numberOfLines={1}>
                            {real.icon} {real.title}
                          </Text>
                          <Text style={styles.deviceSub} numberOfLines={1}>
                            {dev.currentPlayback?.isPlaying
                              ? `🟢 En lecture : ${dev.currentPlayback.mediaTitle}`
                              : `🟢 Connecté • ${dev.currentRoute || 'Accueil'}`}
                          </Text>
                          <View style={styles.statusBadgeOnline}>
                            <Text style={styles.statusBadgeOnlineTxt} pointerEvents="none">En ligne & synchronisé</Text>
                          </View>
                        </View>
                      </View>

                      {/* Les 5 boutons d'action demandés */}
                      <View style={styles.actionsGrid}>
                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnDisconnect]}
                          onPress={() => handleDisconnectAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnDisconnectTxt]}>
                            🔴 Déconnecter
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnSync]}
                          onPress={() => handleSyncAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnSyncTxt]}>
                            🔄 Synchroniser
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnCast]}
                          onPress={() => handleCastToAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnCastTxt]}>
                            📡 Caster
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnFollow]}
                          onPress={() => handleFollowAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnFollowTxt]}>
                            👀 Suivre
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnConnect]}
                          onPress={() => handleConnectAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnConnectTxt]}>
                            🎮 Connecter
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 2. Cibles Cast connectées */}
                {connectedCastDevices.map((d) => {
                  const real = getRealDeviceDisplayName({ name: d.name, deviceType: d.deviceType });
                  return (
                    <View key={d.id} style={styles.deviceCardConnected}>
                      <View style={styles.deviceCardTop}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.deviceName} numberOfLines={1}>
                            {real.icon} {real.title}
                          </Text>
                          <Text style={styles.deviceSub} numberOfLines={1}>
                            {d.isPlaying ? `🟢 En lecture : ${d.mediaTitle || 'Média'}` : '🟢 Connecté'}
                          </Text>
                          <View style={styles.statusBadgeOnline}>
                            <Text style={styles.statusBadgeOnlineTxt} pointerEvents="none">Cast actif</Text>
                          </View>
                        </View>
                      </View>

                      {/* Les 5 boutons d'action */}
                      <View style={styles.actionsGrid}>
                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnDisconnect]}
                          onPress={() => handleDisconnectCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnDisconnectTxt]}>
                            🔴 Déconnecter
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnSync]}
                          onPress={() => handleSyncCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnSyncTxt]}>
                            🔄 Synchroniser
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnCast]}
                          onPress={() => handleCastToCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnCastTxt]}>
                            📡 Caster
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnFollow]}
                          onPress={() => handleFollowCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnFollowTxt]}>
                            👀 Suivre
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnConnect]}
                          onPress={() => handleConnectCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnConnectTxt]}>
                            🎮 Connecter
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 3. Google Cast / TV connectée */}
                {isNativeCastActive && (
                  <View style={styles.deviceCardConnected}>
                    <View style={styles.deviceCardTop}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          📺 {activeCastTarget?.name || 'Télévision / Google Cast'}
                        </Text>
                        <Text style={styles.deviceSub} numberOfLines={1}>
                          🟢 Diffusion sans fil active
                        </Text>
                        <View style={styles.statusBadgeOnline}>
                          <Text style={styles.statusBadgeOnlineTxt} pointerEvents="none">Google Cast / AirPlay</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.actionsGrid}>
                      <Pressable
                        accessibilityRole="button"
                        style={[styles.actionBtn, styles.btnDisconnect]}
                        onPress={() => disconnectCastTotally(false)}
                      >
                        <Text style={[styles.actionBtnText, styles.btnDisconnectTxt]}>
                          🔴 Déconnecter
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ========================================================= */}
            {/* SECTION 2 : ÉCRANS EN ATTENTE / INDÉPENDANTS / VEILLE     */}
            {/* ========================================================= */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleDisconnected}>
                ⚪ Mes écrans disponibles ou en veille ({totalDisconnectedCount})
              </Text>
            </View>

            {totalDisconnectedCount === 0 ? (
              <Text style={styles.emptyText}>Aucun écran en veille.</Text>
            ) : (
              <>
                {/* 1. Appareils de compte en veille ou autonomes */}
                {disconnectedAccountDevices.map((dev) => {
                  const real = getRealDeviceDisplayName(dev);
                  const isStandalone = dev.isOnline && dev.syncGroupId === 'standalone';
                  return (
                    <View key={dev.deviceId} style={styles.deviceCardDisconnected}>
                      <View style={styles.deviceCardTop}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.deviceName} numberOfLines={1}>
                            {real.icon} {real.title}
                          </Text>
                          <Text style={styles.deviceSub} numberOfLines={1}>
                            {isStandalone
                              ? '⚪ Mode indépendant (Hors synchronisation)'
                              : '⚪ Hors ligne'}
                          </Text>
                          <View style={styles.statusBadgeOffline}>
                            <Text style={styles.statusBadgeOfflineTxt} pointerEvents="none">
                              {isStandalone ? 'Autonome' : 'En veille'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Les 5 boutons d'action */}
                      <View style={styles.actionsGrid}>
                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnDisconnect]}
                          onPress={() => handleDisconnectAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnDisconnectTxt]}>
                            🔴 Déconnecter
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnSync]}
                          onPress={() => handleSyncAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnSyncTxt]}>
                            🔄 Synchroniser
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnCast]}
                          onPress={() => handleCastToAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnCastTxt]}>
                            📡 Caster
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnFollow]}
                          onPress={() => handleFollowAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnFollowTxt]}>
                            👀 Suivre
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnConnect]}
                          onPress={() => handleConnectAccountDevice(dev)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnConnectTxt]}>
                            🎮 Connecter
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 2. Cibles Cast en veille */}
                {disconnectedCastDevices.map((d) => {
                  const real = getRealDeviceDisplayName({ name: d.name, deviceType: d.deviceType });
                  return (
                    <View key={d.id} style={styles.deviceCardDisconnected}>
                      <View style={styles.deviceCardTop}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.deviceName} numberOfLines={1}>
                            {real.icon} {real.title}
                          </Text>
                          <Text style={styles.deviceSub} numberOfLines={1}>
                            ⚪ Disponible sur le réseau local
                          </Text>
                          <View style={styles.statusBadgeOffline}>
                            <Text style={styles.statusBadgeOfflineTxt} pointerEvents="none">En veille</Text>
                          </View>
                        </View>
                      </View>

                      {/* Les 5 boutons d'action */}
                      <View style={styles.actionsGrid}>
                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnDisconnect]}
                          onPress={() => handleDisconnectCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnDisconnectTxt]}>
                            🔴 Déconnecter
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnSync]}
                          onPress={() => handleSyncCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnSyncTxt]}>
                            🔄 Synchroniser
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnCast]}
                          onPress={() => handleCastToCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnCastTxt]}>
                            📡 Caster
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnFollow]}
                          onPress={() => handleFollowCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnFollowTxt]}>
                            👀 Suivre
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.actionBtn, styles.btnConnect]}
                          onPress={() => handleConnectCastDevice(d)}
                        >
                          <Text style={[styles.actionBtnText, styles.btnConnectTxt]}>
                            🎮 Connecter
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 3. Détection TV / Google Cast si aucune TV découverte */}
                {!hasDiscoveredTv && (
                  <View style={styles.deviceCardDisconnected}>
                    <View style={styles.deviceCardTop}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          📺 Télévision / Google Cast
                        </Text>
                        <Text style={styles.deviceSub} numberOfLines={1}>
                          ⚪ Détecter une TV locale (Chromecast, Android TV, AirPlay)
                        </Text>
                        <View style={styles.statusBadgeOffline}>
                          <Text style={styles.statusBadgeOfflineTxt} pointerEvents="none">Réseau local</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.actionsGrid}>
                      <Pressable
                        accessibilityRole="button"
                        style={[styles.actionBtn, styles.btnCast]}
                        onPress={handleNativeCast}
                      >
                        <Text style={[styles.actionBtnText, styles.btnCastTxt]}>
                          📡 Caster
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        style={[styles.actionBtn, styles.btnConnect]}
                        onPress={handleNativeCast}
                      >
                        <Text style={[styles.actionBtnText, styles.btnConnectTxt]}>
                          🎮 Connecter
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
};
