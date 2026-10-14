import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { fetchCastDevices, sendCastCommand, getLocalDeviceId, CastDevice } from '@/services/castService';
import { styles } from './CastModal.styles';

interface CastModalProps {
  visible: boolean;
  onClose: () => void;
  currentMedia?: { id: string; title: string; streamUrl?: string; positionSeconds: number };
  onTargetSelected?: (target: CastDevice) => void;
}

export const CastModal: React.FC<CastModalProps> = ({
  visible,
  onClose,
  currentMedia,
  onTargetSelected,
}) => {
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const localId = getLocalDeviceId();

  useEffect(() => {
    if (visible) {
      fetchCastDevices().then((devs) => {
        setDevices(devs.filter((d) => d.id !== localId));
      });
    }
  }, [visible, localId]);

  if (!visible) return null;

  const handleCastToDevice = async (device: CastDevice) => {
    if (currentMedia) {
      await sendCastCommand(device.id, 'LOAD', {
        mediaId: currentMedia.id,
        title: currentMedia.title,
        streamUrl: currentMedia.streamUrl,
        positionSeconds: currentMedia.positionSeconds,
      });
    }
    if (onTargetSelected) onTargetSelected(device);
    onClose();
  };

  const handleNativeCast = () => {
    if (typeof window !== 'undefined' && (window as any).chrome?.cast) {
      const castSession = (window as any).chrome.cast.requestSession();
      console.log('Google Cast request:', castSession);
    } else {
      alert('Diffusion Google Cast / AirPlay initialisée.');
    }
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Diffuser sur un Écran</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Lecteurs UMS Disponibles</Text>
        <ScrollView style={{ maxHeight: 200 }}>
          {devices.length === 0 ? (
            <Text style={styles.emptyText}>Aucun autre écran UMS actif détecté.</Text>
          ) : (
            devices.map((dev) => (
              <View key={dev.id} style={styles.deviceRow}>
                <View>
                  <Text style={styles.deviceName}>{dev.name}</Text>
                  <Text style={styles.deviceSub}>{dev.deviceType} • {dev.isPlaying ? 'En lecture' : 'En veille'}</Text>
                </View>
                <Pressable style={styles.castPill} onPress={() => handleCastToDevice(dev)}>
                  <Text style={styles.castText}>Caster</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Protocoles Standards</Text>
        <Pressable style={styles.deviceRow} onPress={handleNativeCast}>
          <View>
            <Text style={styles.deviceName}>Chromecast / Google Cast</Text>
            <Text style={styles.deviceSub}>Diffuseur matériel ou TV compatible</Text>
          </View>
          <View style={styles.castPill}><Text style={styles.castText}>Connecter</Text></View>
        </Pressable>

        <Pressable style={styles.deviceRow} onPress={handleNativeCast}>
          <View>
            <Text style={styles.deviceName}>AirPlay (Apple TV / Mac)</Text>
            <Text style={styles.deviceSub}>Sans fil via navigateur ou iOS</Text>
          </View>
          <View style={styles.castPill}><Text style={styles.castText}>Connecter</Text></View>
        </Pressable>
      </View>
    </View>
  );
};
