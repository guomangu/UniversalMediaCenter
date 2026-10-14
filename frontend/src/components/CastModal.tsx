import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import {
  fetchCastDevices,
  sendCastCommand,
  getLocalDeviceId,
  getLocalDeviceName,
  setLocalDeviceName,
  registerAsReceiver,
  triggerNativeCast,
  CastDevice,
} from '@/services/castService';
import { setActiveCastTarget } from '@/services/castState';
import { styles } from './CastModal.styles';

interface CastModalProps {
  visible: boolean;
  onClose: () => void;
  currentMedia?: { id: string; title: string; streamUrl?: string; positionSeconds: number };
  onTargetSelected?: (target: CastDevice) => void;
}

export const CastModal: React.FC<CastModalProps> = ({ visible, onClose, currentMedia, onTargetSelected }) => {
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [myDeviceName, setMyDeviceName] = useState(getLocalDeviceName());
  const localId = getLocalDeviceId();
  const nativeBtnRef = useRef<any>(null);

  const refresh = () => fetchCastDevices().then((d) => setDevices(d.filter((x) => x.id !== localId)));

  useEffect(() => {
    if (!visible) return;
    refresh();
    setTimeout(() => nativeBtnRef.current?.focus?.(), 60);
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [visible, localId]);

  if (!visible) return null;

  const handleNativeCast = async () => {
    onClose();
    await triggerNativeCast();
  };

  const handleRename = () => {
    const next = Platform.OS === 'web' ? window.prompt('Nom de cet appareil :', myDeviceName) : null;
    if (next?.trim()) {
      setLocalDeviceName(next.trim());
      setMyDeviceName(next.trim());
      registerAsReceiver(next.trim(), {});
    }
  };

  const handleSelect = async (device: CastDevice, cast: boolean) => {
    if (cast && currentMedia) {
      await sendCastCommand(device.id, 'LOAD', {
        mediaId: currentMedia.id, title: currentMedia.title,
        streamUrl: currentMedia.streamUrl, positionSeconds: currentMedia.positionSeconds,
      });
    }
    setActiveCastTarget(device);
    onTargetSelected?.(device);
    onClose();
  };

  return (
    <View style={styles.overlay}>
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

        <Text style={styles.sectionTitle}>Appareils UMS connectés</Text>
        <ScrollView style={{ maxHeight: 180 }}>
          {devices.length === 0 ? (
            <Text style={styles.emptyText}>Aucun autre écran UMS actif détecté sur le réseau local.</Text>
          ) : (
            devices.map((d) => (
              <View key={d.id} style={styles.deviceRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.deviceName} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.deviceSub} numberOfLines={1}>{d.isPlaying ? `🟢 ${d.mediaTitle || 'Lecture'}` : '⚪ En veille'}</Text>
                </View>
                <View style={styles.rowActions}>
                  {currentMedia && (
                    <Pressable focusable={true} style={styles.castPill} onPress={() => handleSelect(d, true)}>
                      <Text style={styles.castText}>Caster</Text>
                    </Pressable>
                  )}
                  <Pressable focusable={true} style={styles.remotePill} onPress={() => handleSelect(d, false)}>
                    <Text style={styles.castText}>Contrôler</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};
