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
import { getVideoStreamUrl, fetchNextMedia } from '@/services/api';
import { styles } from '@/components/PlayerScreen.styles';

export default function PlayerScreen() {
  const { id, title, share } = useLocalSearchParams<{ id: string; title?: string; share?: string }>();
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
  const [nextNode, setNextNode] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimer = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  const mediaTitle = title || `Média #${id}`;
  const showToast = (msg: string) => { setStatusMessage(msg); setTimeout(() => setStatusMessage(''), 3000); };

  const streamUrl = useMemo(() => {
    if (!id) return '';
    const base = getVideoStreamUrl(id, share);
    const p = new URLSearchParams();
    if (activeAudio && activeAudio !== 'auto') p.set('audio', activeAudio);
    if (activeQuality && activeQuality !== 'auto') p.set('quality', activeQuality);
    if (share) p.set('share', share);
    const qs = p.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  }, [id, activeAudio, activeQuality, share]);

  useEffect(() => {
    if (id) {
      fetchMediaTracks(String(id)).then(setTracks);
      isCancelledRef.current = false;
      setCountdown(null);
      fetchNextMedia(String(id)).then(setNextNode);
    }
  }, [id]);

  // Compte à rebours automatique Netflix
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextNode && !isCancelledRef.current) {
        handlePlayNext();
      }
      return;
    }
    countdownTimer.current = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(countdownTimer.current);
  }, [countdown, nextNode]);

  const handlePlayNext = () => {
    if (!nextNode) return;
    setCountdown(null);
    router.replace({
      pathname: `/player/${nextNode.id}`,
      params: share ? { share } : undefined,
    } as any);
  };

  const handleCancelNext = () => {
    isCancelledRef.current = true;
    setCountdown(null);
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
    showToast('Enchaînement automatique annulé');
  };

  const handleNearEnd = (remainingSec: number) => {
    if (nextNode && !isCancelledRef.current && countdown === null) {
      setCountdown(Math.min(remainingSec, 8));
    }
  };

  const handleVideoEnded = () => {
    if (nextNode && !isCancelledRef.current) {
      handlePlayNext();
    }
  };

  useCastReceiver({
    id: String(id), mediaTitle, isPlaying, videoRef, setIsPlaying, setActiveAudio, setActiveSubtitle,
    onStop: () => { if (router.canGoBack()) router.back(); else router.push('/'); },
    onLoad: (newId) => router.replace(`/player/${newId}`),
  });

  const isModalOpen = showQuality || showAudio || showSubtitles || showShare || showCast;
  usePlayerControls({ videoRef, isPlaying, setIsPlaying, isModalOpen, activeCastTarget, showToast });

  const handleSeekDelta = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    const current = (videoRef.current.currentTime || savedPosRef.current || 0) + deltaSeconds;
    const clamped = Math.max(0, current);
    videoRef.current.currentTime = clamped;
    savedPosRef.current = clamped;
    showToast(`${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}s`);
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
        activeAudio={activeAudio}
        statusMessage={statusMessage}
        onSkipIntro={() => { handleSeekDelta(85); setShowSkipIntro(false); }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onNearEnd={handleNearEnd}
        onEnded={handleVideoEnded}
      />

      <View style={styles.topBar}>
        <Pressable focusable={true} onPress={() => { if (router.canGoBack()) router.back(); else router.push('/'); }} style={styles.topBtn}>
          <Text style={styles.topBtnText}>← Retour</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{mediaTitle}</Text>
        <View style={styles.rightActions}>
          <Pressable focusable={true} onPress={() => setShowShare(true)} style={styles.topBtn}>
            <Text style={styles.topBtnText}>🔗 Partager</Text>
          </Pressable>
          <Pressable focusable={true} onPress={() => setShowCast(true)} style={[styles.topBtn, activeCastTarget && styles.castActiveBtn]}>
            <Text style={styles.topBtnText}>{activeCastTarget ? `📡 ${activeCastTarget.name}` : '📡 Cast'}</Text>
          </Pressable>
          <Pressable focusable={true} onPress={() => setShowAudio(true)} style={styles.topBtn}>
            <Text style={styles.topBtnText}>🔊 Audio</Text>
          </Pressable>
          <Pressable focusable={true} onPress={() => setShowSubtitles(true)} style={styles.topBtn}>
            <Text style={styles.topBtnText}>💬 ST</Text>
          </Pressable>
          <Pressable focusable={true} onPress={() => setShowQuality(true)} style={styles.topBtn}>
            <Text style={styles.topBtnText}>⚙️ Qualité</Text>
          </Pressable>
        </View>
      </View>

      {/* Netflix Binge-Watching Next Episode Overlay */}
      {countdown !== null && nextNode && (
        <View style={styles.nextOverlay}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextCountdown}>Épisode suivant dans {countdown}s...</Text>
            {nextNode.displayBadge || nextNode.seasonEpisodeTag ? (
              <View style={styles.nextBadge}>
                <Text style={styles.nextBadgeText}>{nextNode.displayBadge || nextNode.seasonEpisodeTag}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.nextTitle} numberOfLines={2}>{nextNode.title}</Text>
          <View style={styles.nextActions}>
            <Pressable focusable={true} onPress={handlePlayNext} style={styles.nextPlayBtn}>
              <Text style={styles.nextPlayBtnText}>▶ Regarder maintenant</Text>
            </Pressable>
            <Pressable focusable={true} onPress={handleCancelNext} style={styles.nextCancelBtn}>
              <Text style={styles.nextCancelBtnText}>✕ Annuler</Text>
            </Pressable>
          </View>
        </View>
      )}

      <PlayerAudioModal
        visible={showAudio}
        tracks={tracks.audioTracks}
        activeAudio={activeAudio}
        onSelect={(val) => { setActiveAudio(val); setShowAudio(false); }}
        onClose={() => setShowAudio(false)}
      />

      <PlayerSubtitleModal
        visible={showSubtitles}
        tracks={tracks.subtitleTracks}
        activeSubtitle={activeSubtitle}
        onSelect={(val) => { setActiveSubtitle(val); setShowSubtitles(false); }}
        onClose={() => setShowSubtitles(false)}
      />

      <PlayerQualityModal
        visible={showQuality}
        qualities={tracks.qualities}
        activeQuality={activeQuality}
        onSelect={(val) => { setActiveQuality(val); setShowQuality(false); }}
        onClose={() => setShowQuality(false)}
      />

      <PlayerShareModal
        visible={showShare}
        mediaId={String(id)}
        mediaTitle={mediaTitle}
        onClose={() => setShowShare(false)}
      />

      <CastModal
        visible={showCast}
        onClose={() => setShowCast(false)}
        currentMedia={{ id: String(id), title: mediaTitle, positionSeconds: savedPosRef.current }}
      />
    </SafeAreaView>
  );
}
