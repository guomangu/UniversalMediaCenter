import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CastModal } from '@/components/CastModal';
import { VideoPlayerView } from '@/components/VideoPlayerView';
import { PlayerQualityModal } from '@/components/PlayerQualityModal';
import { PlayerSubtitleModal } from '@/components/PlayerSubtitleModal';
import { PlayerAudioModal } from '@/components/PlayerAudioModal';
import { PlayerShareModal } from '@/components/PlayerShareModal';
import { useCastReceiver } from '@/hooks/useCastReceiver';
import { usePlayerControls } from '@/hooks/usePlayerControls';
import { useActiveCastTarget } from '@/services/castState';
import { fetchMediaTracks, MediaTracksData } from '@/services/mediaTracksApi';
import { getVideoStreamUrl } from '@/services/api';
import { styles } from '@/components/PlayerScreen.styles';

export default function PlayerScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const router = useRouter();
  const videoRef = useRef<any>(null);
  const savedPosRef = useRef<number>(0);
  const activeCastTarget = useActiveCastTarget();
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSkipIntro, setShowSkipIntro] = useState(true);
  const [showCast, setShowCast] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeQuality, setActiveQuality] = useState('auto');
  const [activeSubtitle, setActiveSubtitle] = useState('off');
  const [activeAudio, setActiveAudio] = useState('auto');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [tracks, setTracks] = useState<MediaTracksData>({ audioTracks: [], subtitleTracks: [], qualities: [] });

  const mediaTitle = title || `Média #${id}`;
  const showToast = (msg: string) => { setStatusMessage(msg); setTimeout(() => setStatusMessage(''), 3000); };

  const streamUrl = useMemo(() => {
    if (!id) return '';
    const base = getVideoStreamUrl(id);
    const p = new URLSearchParams();
    if (activeAudio && activeAudio !== 'auto') p.set('audio', activeAudio);
    if (activeQuality && activeQuality !== 'auto') p.set('quality', activeQuality);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  }, [id, activeAudio, activeQuality]);

  useEffect(() => { if (id) fetchMediaTracks(String(id)).then(setTracks); }, [id]);

  useCastReceiver({
    id: String(id), mediaTitle, isPlaying, videoRef, setIsPlaying, setActiveAudio, setActiveSubtitle,
    onStop: () => { if (router.canGoBack()) router.back(); else router.push('/'); },
    onLoad: (newId) => router.replace(`/player/${newId}`),
  });

  const isModalOpen = showQuality || showAudio || showSubtitles || showShare || showCast;
  usePlayerControls({ videoRef, isPlaying, setIsPlaying, isModalOpen, activeCastTarget, showToast });

  const selectQuality = (q: string) => { savedPosRef.current = videoRef.current?.currentTime || 0; setActiveQuality(q); showToast(`⚙️ Qualité : ${q.toUpperCase()}`); };
  const selectAudio = (a: string) => { savedPosRef.current = videoRef.current?.currentTime || 0; setActiveAudio(a); showToast(`🔊 Piste audio : ${a}`); };

  return (
    <SafeAreaView style={styles.container}>
      <VideoPlayerView
        id={String(id)} streamUrl={streamUrl} isPlaying={isPlaying} videoRef={videoRef}
        showSkipIntro={showSkipIntro} intro={tracks.intro} activeSubtitle={activeSubtitle}
        activeQuality={activeQuality} activeAudio={activeAudio} statusMessage={statusMessage}
        initialTime={savedPosRef.current} onSkipIntro={() => { const end = tracks.intro?.end ?? 90.04; if (videoRef.current) videoRef.current.currentTime = end; setShowSkipIntro(false); }}
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
      />
      <View style={styles.controlsBar}>
        <View style={styles.leftGroup}>
          <Pressable focusable={true} onPress={() => { if (router.canGoBack()) router.back(); else router.push('/'); }} style={styles.btn}><Text style={styles.btnText}>✕ Fermer</Text></Pressable>
          <Pressable focusable={true} onPress={() => { if (videoRef.current) { isPlaying ? videoRef.current.pause?.() : videoRef.current.play?.(); } setIsPlaying(!isPlaying); }} style={[styles.btn, styles.primaryBtn]}><Text style={styles.primaryText}>{isPlaying ? '⏸ Pause' : '▶ Lecture'}</Text></Pressable>
        </View>
        <View style={styles.rightGroup}>
          <Pressable focusable={true} onPress={() => router.push({ pathname: '/forum/[topic]', params: { topic: `tv-${id}`, title: mediaTitle } } as any)} style={styles.btn}><Text style={styles.btnText}>💬 Forum</Text></Pressable>
          <Pressable focusable={true} onPress={() => setShowQuality(true)} style={styles.btn}><Text style={styles.btnText}>⚙️ {activeQuality.toUpperCase()}</Text></Pressable>
          <Pressable focusable={true} onPress={() => setShowAudio(true)} style={styles.btn}><Text style={styles.btnText}>🔊 Audio ({tracks.audioTracks.length})</Text></Pressable>
          <Pressable focusable={true} onPress={() => setShowSubtitles(true)} style={styles.btn}><Text style={styles.btnText}>💬 {activeSubtitle === 'off' ? 'ST: Off' : 'ST: Actif'}</Text></Pressable>
          <Pressable focusable={true} onPress={() => setShowShare(true)} style={styles.btn}><Text style={styles.btnText}>🔗 Partager</Text></Pressable>
          <Pressable focusable={true} onPress={() => setShowCast(true)} style={[styles.btn, styles.castBtn]}><Text style={styles.castText}>📡 Caster</Text></Pressable>
        </View>
      </View>
      <PlayerQualityModal visible={showQuality} activeQuality={activeQuality} qualities={tracks.qualities} onSelect={selectQuality} onClose={() => setShowQuality(false)} />
      <PlayerAudioModal visible={showAudio} activeAudio={activeAudio} tracks={tracks.audioTracks} onSelect={selectAudio} onClose={() => setShowAudio(false)} />
      <PlayerSubtitleModal visible={showSubtitles} activeSubtitle={activeSubtitle} tracks={tracks.subtitleTracks} onSelect={(s) => { setActiveSubtitle(s); showToast(s === 'off' ? '💬 ST désactivés' : '💬 ST activés'); }} onClose={() => setShowSubtitles(false)} />
      <PlayerShareModal visible={showShare} mediaId={String(id)} onClose={() => setShowShare(false)} />
      <CastModal visible={showCast} onClose={() => setShowCast(false)} currentMedia={{ id: String(id), title: mediaTitle, positionSeconds: videoRef.current?.currentTime || 0 }} onTargetSelected={() => { videoRef.current?.pause?.(); setIsPlaying(false); }} />
    </SafeAreaView>
  );
}
