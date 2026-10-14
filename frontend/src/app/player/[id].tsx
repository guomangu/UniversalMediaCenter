import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CastModal } from '@/components/CastModal';
import { CastControlBar } from '@/components/CastControlBar';
import { VideoPlayerView } from '@/components/VideoPlayerView';
import { PlayerQualityModal } from '@/components/PlayerQualityModal';
import { PlayerSubtitleModal } from '@/components/PlayerSubtitleModal';
import { PlayerShareModal } from '@/components/PlayerShareModal';
import { registerAsReceiver, pollDeviceCommands, getLocalDeviceId, CastDevice } from '@/services/castService';
import { getVideoStreamUrl } from '@/services/api';
import { styles } from '@/components/PlayerScreen.styles';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const videoRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSkipIntro, setShowSkipIntro] = useState(true);
  const [showCast, setShowCast] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeQuality, setActiveQuality] = useState('auto');
  const [activeSubtitle, setActiveSubtitle] = useState('off');
  const [activeCastTarget, setActiveCastTarget] = useState<CastDevice | null>(null);

  const streamUrl = id ? getVideoStreamUrl(id) : '';

  useEffect(() => {
    registerAsReceiver(`Écran UMS (${id})`, { isPlaying, positionSeconds: 0, durationSeconds: 7200 });
    const interval = setInterval(() => {
      pollDeviceCommands(getLocalDeviceId(), (cmd) => {
        if (cmd.action === 'PAUSE') { setIsPlaying(false); videoRef.current?.pause?.(); }
        if (cmd.action === 'PLAY') { setIsPlaying(true); videoRef.current?.play?.(); }
        if (cmd.action === 'STOP') router.back();
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [id, isPlaying]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause?.();
      else videoRef.current.play?.();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <SafeAreaView style={styles.container}>
      <VideoPlayerView
        id={String(id)}
        streamUrl={streamUrl}
        isPlaying={isPlaying}
        videoRef={videoRef}
        showSkipIntro={showSkipIntro}
        onSkipIntro={() => {
          if (videoRef.current) videoRef.current.currentTime = (videoRef.current.currentTime || 0) + 85;
          setShowSkipIntro(false);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <View style={styles.controlsBar}>
        <View style={styles.leftGroup}>
          <Pressable onPress={() => router.back()} style={styles.btn}><Text style={styles.btnText}>✕ Fermer</Text></Pressable>
          <Pressable onPress={togglePlay} style={[styles.btn, styles.primaryBtn]}>
            <Text style={styles.primaryText}>{isPlaying ? '⏸ Pause' : '▶ Lecture'}</Text>
          </Pressable>
        </View>

        <View style={styles.rightGroup}>
          <Pressable onPress={() => setShowQuality(true)} style={styles.btn}>
            <Text style={styles.btnText}>⚙️ {activeQuality.toUpperCase()}</Text>
          </Pressable>
          <Pressable onPress={() => setShowSubtitles(true)} style={styles.btn}>
            <Text style={styles.btnText}>💬 {activeSubtitle === 'off' ? 'ST: Off' : 'ST: Actif'}</Text>
          </Pressable>
          <Pressable onPress={() => setShowShare(true)} style={styles.btn}>
            <Text style={styles.btnText}>🔗 Partager</Text>
          </Pressable>
          <Pressable onPress={() => setShowCast(true)} style={[styles.btn, styles.castBtn]}>
            <Text style={styles.castText}>📡 Caster</Text>
          </Pressable>
        </View>
      </View>

      <PlayerQualityModal visible={showQuality} activeQuality={activeQuality} onSelect={setActiveQuality} onClose={() => setShowQuality(false)} />
      <PlayerSubtitleModal visible={showSubtitles} activeSubtitle={activeSubtitle} onSelect={setActiveSubtitle} onClose={() => setShowSubtitles(false)} />
      <PlayerShareModal visible={showShare} mediaId={String(id)} onClose={() => setShowShare(false)} />
      <CastModal visible={showCast} onClose={() => setShowCast(false)} currentMedia={{ id: String(id), title: `Média #${id}`, positionSeconds: 120 }} onTargetSelected={(t) => { setActiveCastTarget(t); videoRef.current?.pause?.(); setIsPlaying(false); }} />
      {activeCastTarget && <CastControlBar target={activeCastTarget} onDisconnect={() => setActiveCastTarget(null)} />}
    </SafeAreaView>
  );
}
