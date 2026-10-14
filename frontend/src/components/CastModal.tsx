import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { fetchCastDevices, sendCastCommand, getLocalDeviceId, getLocalDeviceName, setLocalDeviceName, registerAsReceiver, CastDevice } from '@/services/castService';
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

  const refresh = () => fetchCastDevices().then((d) => setDevices(d.filter((x) => x.id !== localId)));

  useEffect(() => {
    if (!visible) return;
    refresh();
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [visible, localId]);

  if (!visible) return null;

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
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>📡 Diffuser & Télécommande</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></Pressable>
        </View>

        <View style={styles.localBox}>
          <View>
            <Text style={styles.localLabel}>Cet appareil :</Text>
            <Text style={styles.localName}>{myDeviceName}</Text>
          </View>
          <Pressable style={styles.editBtn} onPress={handleRename}><Text style={styles.editBtnTxt}>✏️ Renommer</Text></Pressable>
        </View>

        <Text style={styles.sectionTitle}>Appareils UMS sur le réseau</Text>
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
                    <Pressable style={styles.castPill} onPress={() => handleSelect(d, true)}><Text style={styles.castText}>Caster</Text></Pressable>
                  )}
                  <Pressable style={styles.remotePill} onPress={() => handleSelect(d, false)}><Text style={styles.castText}>Contrôler</Text></Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};
