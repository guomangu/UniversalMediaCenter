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
  UserConnectedDevice,
} from '@/services/userDeviceService';
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
  const nativeBtnRef = useRef<any>(null);

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
    setTimeout(() => nativeBtnRef.current?.focus?.(), 60);
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [visible, localId]);

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

  const handleSelectAccountDevice = async (dev: UserConnectedDevice, cast: boolean, sync: boolean = false) => {
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

    const castAdapter: CastDevice = {
      id: dev.deviceId,
      name: dev.customName || dev.name,
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

  const handleStopActiveCast = async () => {
    await disconnectCastTotally(true);
    onClose();
  };

  const handleDisconnectTarget = async () => {
    await disconnectCastTotally(false);
    onClose();
  };

  const handleGoToManageDevices = () => {
    onClose();
    router.push({ pathname: '/user', params: { tab: 'DEVICES' } } as any);
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
              <Text style={styles.infoBannerText}>⚠️ {feedbackNotice}</Text>
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
                <Pressable focusable={true} style={styles.disconnectBtn} onPress={handleDisconnectTarget}>
                  <Text style={styles.disconnectBtnTxt}>Déconnecter</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Bouton Cast Natif Officiel (Chromecast, Smart TV, Android TV, AirPlay) */}
          <Pressable ref={nativeBtnRef} focusable={true} style={styles.nativeCastBtn} onPress={handleNativeCast}>
            <Text style={styles.nativeCastIcon}>📺</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nativeCastTitle}>Caster sur ma Télévision</Text>
              <Text style={styles.nativeCastSub}>Détecte votre TV locale via Google Cast / AirPlay (comme YouTube)</Text>
            </View>
          </Pressable>

          <View style={styles.localBox}>
            <View>
              <Text style={styles.localLabel}>Cet appareil :</Text>
              <Text style={styles.localName}>{myDeviceName}</Text>
            </View>
            <Pressable focusable={true} style={styles.editBtn} onPress={handleRename}>
              <Text style={styles.editBtnTxt}>✏️ Renommer</Text>
            </Pressable>
          </View>

          {/* Appareils connectés au compte de l'utilisateur */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
            <Text style={styles.sectionTitle}>Mes écrans connectés ({accountDevices.length})</Text>
            <Pressable focusable={true} onPress={handleGoToManageDevices}>
              <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '700' }}>Gérer ⚙️</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 200, flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {accountDevices.length === 0 && devices.length === 0 ? (
              <Text style={styles.emptyText}>Aucun autre écran UMS actif détecté sur le compte ou le réseau local.</Text>
            ) : (
              <>
                {/* Écrans du compte */}
                {accountDevices.map((dev) => (
                  <View key={dev.deviceId} style={styles.deviceRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {dev.customName || dev.name}
                      </Text>
                      <Text style={styles.deviceSub} numberOfLines={1}>
                        {dev.currentPlayback?.isPlaying
                          ? `🟢 En lecture : ${dev.currentPlayback.mediaTitle}`
                          : `📍 ${dev.currentRoute || 'En veille'}`}
                      </Text>
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
                    </View>
                  </View>
                ))}

                {/* Autres récepteurs Cast locaux */}
                {devices.map((d) => (
                  <View key={d.id} style={styles.deviceRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.deviceName} numberOfLines={1}>{d.name}</Text>
                      <Text style={styles.deviceSub} numberOfLines={1}>
                        {d.isPlaying ? `🟢 ${d.mediaTitle || 'Lecture'}` : '⚪ En veille'}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      {currentMedia && (
                        <Pressable focusable={true} style={styles.castPill} onPress={() => handleSelectCastDevice(d, true)}>
                          <Text style={styles.castText}>Caster</Text>
                        </Pressable>
                      )}
                      <Pressable focusable={true} style={styles.remotePill} onPress={() => handleSelectCastDevice(d, false)}>
                        <Text style={styles.castText}>Contrôler</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
