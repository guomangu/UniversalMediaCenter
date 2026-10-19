import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Platform, StyleSheet, Modal } from 'react-native';
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
import { getRealDeviceDisplayName } from '@/services/deviceIdentity';
import { useActiveCastTarget, setActiveCastTarget, disconnectCastTotally } from '@/services/castState';
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
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const localId = getLocalDeviceId();
  const activeCastTarget = useActiveCastTarget();

  const refresh = () => {
    fetchCastDevices().then((d) => setDevices(d.filter((x) => x.id !== localId)));
    fetchUserDevices().then((res) => {
      setAccountDevices((res.devices || []).filter((x) => x.deviceId !== localId));
    });
  };

  useEffect(() => {
    if (!visible) {
      setFeedbackNotice(null);
      return;
    }
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

  const handleNativeCast = async () => {
    setFeedbackNotice(null);
    const result = await triggerNativeCast(currentMedia);
    if (result.success) {
      onCastStarted?.();
      onClose();
    } else {
      setFeedbackNotice(
        result.message || 'Aucun récepteur Cast trouvé sur ce réseau local. Allumez votre TV ou Chromecast et réessayez.'
      );
    }
  };

  const handleRename = () => {
    const next = Platform.OS === 'web' ? window.prompt('Nom de cet appareil :', myDeviceName) : null;
    if (next?.trim()) {
      setLocalDeviceName(next.trim());
      setMyDeviceName(next.trim());
      registerAsReceiver(next.trim(), {});
    }
  };

  const handleSelectCastDevice = async (device: CastDevice, cast: boolean) => {
    if (cast && currentMedia) {
      const lanUrl = await resolveLanStreamUrl(currentMedia.streamUrl, currentMedia.id);
      await sendCastCommand(device.id, 'LOAD', {
        mediaId: currentMedia.id,
        title: currentMedia.title,
        streamUrl: lanUrl,
        positionSeconds: currentMedia.positionSeconds || 0,
      });
      onCastStarted?.();
    }
    setActiveCastTarget(device);
    onTargetSelected?.(device);
    onClose();
  };

  const handleSelectAccountDevice = async (dev: UserConnectedDevice, cast: boolean, sync: boolean = true) => {
    if (cast && currentMedia) {
      await sendDeviceCommand(dev.deviceId, 'LOAD_MEDIA', {
        mediaId: currentMedia.id,
        title: currentMedia.title,
        streamUrl: currentMedia.streamUrl,
        posterUrl: currentMedia.posterUrl,
        positionSeconds: currentMedia.positionSeconds || 0,
        syncGroupId: sync ? 'default' : 'standalone',
      });
      onCastStarted?.();
    }

    const real = getRealDeviceDisplayName(dev);
    const castAdapter: CastDevice = {
      id: dev.deviceId,
      name: real.title,
      deviceType: (dev.deviceType as any) || 'BROWSER',
      currentMediaId: currentMedia?.id || dev.currentPlayback?.mediaId,
      mediaTitle: currentMedia?.title || dev.currentPlayback?.mediaTitle,
      posterUrl: currentMedia?.posterUrl || dev.currentPlayback?.posterUrl,
      positionSeconds: currentMedia?.positionSeconds || dev.currentPlayback?.positionSeconds || 0,
      durationSeconds: dev.currentPlayback?.durationSeconds || 0,
      isPlaying: dev.currentPlayback?.isPlaying ?? true,
      volume: dev.currentPlayback?.volume ?? 1,
      isMuted: dev.currentPlayback?.isMuted ?? false,
    };

    setActiveCastTarget(castAdapter);
    onTargetSelected?.(castAdapter);
    onClose();
  };

  const handleDisconnectAccountDevice = async (dev: UserConnectedDevice) => {
    const real = getRealDeviceDisplayName(dev);
    setFeedbackNotice(`${real.title} déconnecté de la synchronisation.`);
    await setDeviceSyncGroup(dev.deviceId, 'standalone');
    setAccountDevices((prev) =>
      prev.map((d) => (d.deviceId === dev.deviceId ? { ...d, syncGroupId: 'standalone' } : d))
    );
    if (activeCastTarget?.id === dev.deviceId) {
      setActiveCastTarget(null);
    }
  };

  const handleConnectAccountDevice = async (dev: UserConnectedDevice) => {
    const real = getRealDeviceDisplayName(dev);
    setFeedbackNotice(`${real.title} reconnecté à la synchronisation.`);
    await setDeviceSyncGroup(dev.deviceId, 'default');
    setAccountDevices((prev) =>
      prev.map((d) => (d.deviceId === dev.deviceId ? { ...d, syncGroupId: 'default' } : d))
    );
  };

  const handleDisconnectCastDevice = async (device: CastDevice) => {
    setFeedbackNotice(`${device.name} déconnecté.`);
    await disconnectCastTotally(false);
    setDevices((prev) =>
      prev.map((x) => (x.id === device.id ? { ...x, isPlaying: false } : x))
    );
  };

  const handleDisconnectNativeCast = async () => {
    setFeedbackNotice('Télévision déconnectée.');
    await disconnectCastTotally(false);
  };

  const handleStopActiveCast = async () => {
    await disconnectCastTotally(true);
    onClose();
  };

  const handleGoToManageDevices = () => {
    onClose();
    router.push({ pathname: '/user', params: { tab: 'DEVICES' } } as any);
  };

  // Séparation précise des écrans connectés (en synchro / actifs) et déconnectés (hors synchro / hors ligne)
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

  const totalConnectedCount =
    connectedAccountDevices.length + connectedCastDevices.length + (isNativeCastActive ? 1 : 0);
  const totalDisconnectedCount =
    disconnectedAccountDevices.length + disconnectedCastDevices.length + (!isNativeCastActive ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          {...({ dataSet: { modalBackdrop: 'true' } } as any)}
        />
        <View style={styles.modal} {...({ dataSet: { modalContainer: 'true' } } as any)}>
          <View style={styles.header}>
            <Text style={styles.title}>📡 Diffuser & Télécommande</Text>
            <Pressable
              focusable={true}
              onPress={onClose}
              style={styles.closeBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Message d'information ou avertissement */}
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
                <Pressable focusable={true} style={styles.stopBtn} onPress={handleStopActiveCast}>
                  <Text style={styles.stopBtnTxt}>⏹ Arrêter la lecture TV</Text>
                </Pressable>
                <Pressable focusable={true} style={styles.disconnectBtn} onPress={() => disconnectCastTotally(false)}>
                  <Text style={styles.disconnectBtnTxt}>Déconnecter</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Identité de l'appareil local */}
          <View style={styles.localBox}>
            <View>
              <Text style={styles.localLabel}>Cet appareil :</Text>
              <Text style={styles.localName}>{myDeviceName}</Text>
            </View>
            <Pressable focusable={true} style={styles.editBtn} onPress={handleRename}>
              <Text style={styles.editBtnTxt}>✏️ Renommer</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 380, flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {/* ========================================================= */}
            {/* SECTION 1 : MES ÉCRANS CONNECTÉS (EN SYNCHRONISATION)      */}
            {/* ========================================================= */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleConnected}>
                🟢 Mes écrans connectés ({totalConnectedCount})
              </Text>
              <Pressable focusable={true} onPress={handleGoToManageDevices}>
                <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '700' }}>Gérer ⚙️</Text>
              </Pressable>
            </View>

            {totalConnectedCount === 0 ? (
              <Text style={styles.emptyText}>Aucun écran actuellement en synchronisation.</Text>
            ) : (
              <>
                {/* 1. Écrans du compte en synchronisation */}
                {connectedAccountDevices.map((dev) => {
                  const real = getRealDeviceDisplayName(dev);
                  return (
                    <View key={dev.deviceId} style={styles.deviceRowConnected}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {real.icon} {real.title}
                        </Text>
                        <Text style={styles.deviceSub} numberOfLines={1}>
                          {dev.currentPlayback?.isPlaying
                            ? `🟢 En lecture : ${dev.currentPlayback.mediaTitle}`
                            : `🟢 Synchronisé • ${dev.currentRoute || 'Accueil'}`}
                        </Text>
                        <View style={styles.statusBadgeOnline}>
                          <Text style={styles.statusBadgeOnlineTxt}>En ligne & synchronisé</Text>
                        </View>
                      </View>
                      <View style={styles.rowActions}>
                        {currentMedia && (
                          <Pressable
                            focusable={true}
                            style={styles.castPill}
                            onPress={() => handleSelectAccountDevice(dev, true, true)}
                          >
                            <Text style={styles.castText}>Diffuser</Text>
                          </Pressable>
                        )}
                        <Pressable
                          focusable={true}
                          style={styles.remotePill}
                          onPress={() => handleSelectAccountDevice(dev, false)}
                        >
                          <Text style={styles.castText}>Télécommande</Text>
                        </Pressable>
                        <Pressable
                          focusable={true}
                          style={styles.disconnectPill}
                          onPress={() => handleDisconnectAccountDevice(dev)}
                        >
                          <Text style={styles.disconnectPillTxt}>Déconnecter</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 2. Récepteurs Cast / TV connectés ou actifs */}
                {connectedCastDevices.map((d) => {
                  const real = getRealDeviceDisplayName({ name: d.name, deviceType: d.deviceType });
                  return (
                    <View key={d.id} style={styles.deviceRowConnected}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {real.icon} {real.title}
                        </Text>
                        <Text style={styles.deviceSub} numberOfLines={1}>
                          {d.isPlaying ? `🟢 En lecture : ${d.mediaTitle || 'Média'}` : '🟢 Connecté'}
                        </Text>
                        <View style={styles.statusBadgeOnline}>
                          <Text style={styles.statusBadgeOnlineTxt}>Cast actif</Text>
                        </View>
                      </View>
                      <View style={styles.rowActions}>
                        {currentMedia && (
                          <Pressable
                            focusable={true}
                            style={styles.castPill}
                            onPress={() => handleSelectCastDevice(d, true)}
                          >
                            <Text style={styles.castText}>Diffuser</Text>
                          </Pressable>
                        )}
                        <Pressable
                          focusable={true}
                          style={styles.remotePill}
                          onPress={() => handleSelectCastDevice(d, false)}
                        >
                          <Text style={styles.castText}>Télécommande</Text>
                        </Pressable>
                        <Pressable
                          focusable={true}
                          style={styles.disconnectPill}
                          onPress={() => handleDisconnectCastDevice(d)}
                        >
                          <Text style={styles.disconnectPillTxt}>Déconnecter</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 3. Cible Native Cast / Smart TV si active */}
                {isNativeCastActive && (
                  <View style={styles.deviceRowConnected}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        📺 {activeCastTarget?.name || 'Télévision / Google Cast'}
                      </Text>
                      <Text style={styles.deviceSub} numberOfLines={1}>
                        🟢 Diffusion sans fil active
                      </Text>
                      <View style={styles.statusBadgeOnline}>
                        <Text style={styles.statusBadgeOnlineTxt}>Google Cast / AirPlay</Text>
                      </View>
                    </View>
                    <View style={styles.rowActions}>
                      <Pressable
                        focusable={true}
                        style={styles.disconnectPill}
                        onPress={handleDisconnectNativeCast}
                      >
                        <Text style={styles.disconnectPillTxt}>Déconnecter</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ========================================================= */}
            {/* SECTION 2 : MES ÉCRANS DÉCONNECTÉS (HORS SYNCHRO / VEILLE) */}
            {/* ========================================================= */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleDisconnected}>
                ⚪ Mes écrans déconnectés ({totalDisconnectedCount})
              </Text>
            </View>

            {totalDisconnectedCount === 0 ? (
              <Text style={styles.emptyText}>Aucun écran déconnecté.</Text>
            ) : (
              <>
                {/* 1. Écrans du compte déconnectés ou hors synchro */}
                {disconnectedAccountDevices.map((dev) => {
                  const real = getRealDeviceDisplayName(dev);
                  const isStandalone = dev.isOnline && dev.syncGroupId === 'standalone';
                  return (
                    <View key={dev.deviceId} style={styles.deviceRowDisconnected}>
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
                          <Text style={styles.statusBadgeOfflineTxt}>
                            {isStandalone ? 'Autonome' : 'Déconnecté'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.rowActions}>
                        {currentMedia && (
                          <Pressable
                            focusable={true}
                            style={styles.castPill}
                            onPress={() => handleSelectAccountDevice(dev, true, true)}
                          >
                            <Text style={styles.castText}>Diffuser</Text>
                          </Pressable>
                        )}
                        <Pressable
                          focusable={true}
                          style={styles.connectPill}
                          onPress={() => handleConnectAccountDevice(dev)}
                        >
                          <Text style={styles.connectPillTxt}>Synchroniser</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 2. Récepteurs Cast / TV du réseau local en attente */}
                {disconnectedCastDevices.map((d) => {
                  const real = getRealDeviceDisplayName({ name: d.name, deviceType: d.deviceType });
                  return (
                    <View key={d.id} style={styles.deviceRowDisconnected}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {real.icon} {real.title}
                        </Text>
                        <Text style={styles.deviceSub} numberOfLines={1}>
                          ⚪ Disponible sur le réseau local
                        </Text>
                        <View style={styles.statusBadgeOffline}>
                          <Text style={styles.statusBadgeOfflineTxt}>En veille</Text>
                        </View>
                      </View>
                      <View style={styles.rowActions}>
                        {currentMedia && (
                          <Pressable
                            focusable={true}
                            style={styles.castPill}
                            onPress={() => handleSelectCastDevice(d, true)}
                          >
                            <Text style={styles.castText}>Diffuser</Text>
                          </Pressable>
                        )}
                        <Pressable
                          focusable={true}
                          style={styles.connectPill}
                          onPress={() => handleSelectCastDevice(d, false)}
                        >
                          <Text style={styles.connectPillTxt}>Connecter</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                {/* 3. Télévision / Google Cast détectable sur le réseau local */}
                {!isNativeCastActive && (
                  <View style={styles.deviceRowDisconnected}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        📺 Télévision / Google Cast
                      </Text>
                      <Text style={styles.deviceSub} numberOfLines={1}>
                        ⚪ Détecte TV locale (Chromecast, Android TV, AirPlay)
                      </Text>
                      <View style={styles.statusBadgeOffline}>
                        <Text style={styles.statusBadgeOfflineTxt}>Réseau local</Text>
                      </View>
                    </View>
                    <View style={styles.rowActions}>
                      {currentMedia && (
                        <Pressable
                          focusable={true}
                          style={styles.castPill}
                          onPress={handleNativeCast}
                        >
                          <Text style={styles.castText}>Diffuser</Text>
                        </Pressable>
                      )}
                      <Pressable
                        focusable={true}
                        style={styles.connectPill}
                        onPress={handleNativeCast}
                      >
                        <Text style={styles.connectPillTxt}>Connecter</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
