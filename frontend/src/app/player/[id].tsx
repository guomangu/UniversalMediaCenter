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
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [activeCastTarget, setActiveCastTarget] = useState<CastDevice | null>(null);

  const streamBase = id ? getVideoStreamUrl(id) : '';
  const streamUrl = activeQuality === 'auto' ? streamBase : `${streamBase}?quality=${activeQuality}`;
  const showToast = (msg: string) => { setStatusMessage(msg); setTimeout(() => setStatusMessage(''), 3000); };

  useEffect(() => {
    registerAsReceiver(`Écran UMS (${id})`, { isPlaying, positionSeconds: 0, durationSeconds: 7200 });
    const interval = setInterval(() => {
      pollDeviceCommands(getLocalDeviceId(), (cmd) => {
        if (cmd.action === 'PAUSE') { setIsPlaying(false); videoRef.current?.pause?.(); }
        if (cmd.action === 'PLAY') { setIsPlaying(true); videoRef.current?.play?.(); }
        if (cmd.action === 'STOP') { if (router.canGoBack()) router.back(); else router.push('/'); }
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

  const handleSkipIntro = () => {
    if (videoRef.current) videoRef.current.currentTime = (videoRef.current.currentTime || 0) + 85;
    setShowSkipIntro(false);
    showToast('⏩ Intro passée (+85 secondes)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <VideoPlayerView
        id={String(id)}
        streamUrl={streamUrl}
        isPlaying={isPlaying}
        videoRef={videoRef}
        showSkipIntro={showSkipIntro}
        activeSubtitle={activeSubtitle}
        activeQuality={activeQuality}
        statusMessage={statusMessage}
        onSkipIntro={handleSkipIntro}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <View style={styles.controlsBar}>
        <View style={styles.leftGroup}>
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.push('/'); }} style={styles.btn}><Text style={styles.btnText}>✕ Fermer</Text></Pressable>
          <Pressable onPress={togglePlay} style={[styles.btn, styles.primaryBtn]}><Text style={styles.primaryText}>{isPlaying ? '⏸ Pause' : '▶ Lecture'}</Text></Pressable>
        </View>

        <View style={styles.rightGroup}>
          <Pressable onPress={() => setShowQuality(true)} style={styles.btn}><Text style={styles.btnText}>⚙️ {activeQuality.toUpperCase()}</Text></Pressable>
          <Pressable onPress={() => setShowSubtitles(true)} style={styles.btn}><Text style={styles.btnText}>💬 {activeSubtitle === 'off' ? 'ST: Off' : 'ST: Actif'}</Text></Pressable>
          <Pressable onPress={() => setShowShare(true)} style={styles.btn}><Text style={styles.btnText}>🔗 Partager</Text></Pressable>
          <Pressable onPress={() => setShowCast(true)} style={[styles.btn, styles.castBtn]}><Text style={styles.castText}>📡 Caster</Text></Pressable>
        </View>
      </View>

      <PlayerQualityModal visible={showQuality} activeQuality={activeQuality} onSelect={(q) => { setActiveQuality(q); showToast(`⚙️ Flux : ${q.toUpperCase()}`); }} onClose={() => setShowQuality(false)} />
      <PlayerSubtitleModal visible={showSubtitles} activeSubtitle={activeSubtitle} onSelect={(s) => { setActiveSubtitle(s); showToast(s === 'off' ? '💬 Sous-titres désactivés' : `💬 Sous-titres : ${s.toUpperCase()}`); }} onClose={() => setShowSubtitles(false)} />
      <PlayerShareModal visible={showShare} mediaId={String(id)} onClose={() => setShowShare(false)} />
      <CastModal visible={showCast} onClose={() => setShowCast(false)} currentMedia={{ id: String(id), title: `Média #${id}`, positionSeconds: 120 }} onTargetSelected={(t) => { setActiveCastTarget(t); videoRef.current?.pause?.(); setIsPlaying(false); }} />
      {activeCastTarget && <CastControlBar target={activeCastTarget} onDisconnect={() => setActiveCastTarget(null)} />}
    </SafeAreaView>
  );
}
