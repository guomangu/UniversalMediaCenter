import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CastModal } from '@/components/CastModal';
import { CastControlBar } from '@/components/CastControlBar';
import { registerAsReceiver, pollDeviceCommands, getLocalDeviceId, CastDevice } from '@/services/castService';
import { styles } from './PlayerScreen.styles';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSkipIntro, setShowSkipIntro] = useState(true);
  const [showCastModal, setShowCastModal] = useState(false);
  const [activeCastTarget, setActiveCastTarget] = useState<CastDevice | null>(null);

  useEffect(() => {
    registerAsReceiver(`Écran UMS (${id})`, { isPlaying, positionSeconds: 0, durationSeconds: 7200 });
    const interval = setInterval(() => {
      pollDeviceCommands(getLocalDeviceId(), (cmd) => {
        if (cmd.action === 'PAUSE') setIsPlaying(false);
        if (cmd.action === 'PLAY') setIsPlaying(true);
        if (cmd.action === 'STOP') router.back();
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [id, isPlaying]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.videoPlaceholder}>
        <Text style={styles.videoText}>🎬 Flux de Lecture Active</Text>
        <Text style={styles.subText}>Média ID : {id} • {isPlaying ? '▶ En cours' : '⏸ Pause'}</Text>

        {showSkipIntro && (
          <Pressable style={styles.skipBtn} onPress={() => setShowSkipIntro(false)}>
            <Text style={styles.skipText}>⏭ Passer l'Introduction</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.controlsBar}>
        <View style={styles.leftGroup}>
          <Pressable onPress={() => router.back()} style={styles.btn}>
            <Text style={styles.btnText}>✕ Fermer</Text>
          </Pressable>
          <Pressable onPress={() => setIsPlaying(!isPlaying)} style={[styles.btn, styles.primaryBtn]}>
            <Text style={styles.primaryText}>{isPlaying ? '⏸ Pause' : '▶ Lecture'}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setShowCastModal(true)} style={[styles.btn, styles.castBtn]}>
          <Text style={styles.castText}>📡 Caster</Text>
        </Pressable>
      </View>

      <CastModal
        visible={showCastModal}
        onClose={() => setShowCastModal(false)}
        currentMedia={{ id: String(id), title: `Média #${id}`, positionSeconds: 120 }}
        onTargetSelected={(target) => {
          setActiveCastTarget(target);
          setIsPlaying(false);
        }}
      />

      {activeCastTarget && (
        <CastControlBar target={activeCastTarget} onDisconnect={() => setActiveCastTarget(null)} />
      )}
    </SafeAreaView>
  );
}
