import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CastModal } from '@/components/CastModal';
import { VideoPlayerView } from '@/components/VideoPlayerView';
import { PlayerSubtitleModal } from '@/components/PlayerSubtitleModal';
import { PlayerAudioModal } from '@/components/PlayerAudioModal';
import { PlayerShareModal } from '@/components/PlayerShareModal';
import { useCastReceiver } from '@/hooks/useCastReceiver';
import { usePlayerControls } from '@/hooks/usePlayerControls';
import { useActiveCastTarget } from '@/services/castState';
import { fetchMediaTracks, MediaTracksData } from '@/services/mediaTracksApi';
import { getVideoStreamUrl, fetchNextMedia, fetchMediaDetail } from '@/services/api';
import {
  fetchMediaSessions,
  pingSession,
  leaveSession,
  reportPlaybackProgress,
  leavePlayback,
  MediaSession,
} from '@/services/sessionApi';
import { styles } from '@/components/PlayerScreen.styles';
import { toggleFullscreen, isFullscreenActive } from '@/utils/fullscreen';
import { goBackOrFallback } from '@/utils/navigation';

export default function PlayerScreen() {
  const { id, title, share, isLive: queryIsLive } = useLocalSearchParams<{ id: string; title?: string; share?: string; isLive?: string }>();
  const router = useRouter();
  const videoRef = useRef<any>(null);
  const savedPosRef = useRef<number>(0);
  const activeCastTarget = useActiveCastTarget();
  const [isPlaying, setIsPlaying] = useState(true);
  const [initialTime, setInitialTime] = useState<number>(0);
  const isDirectLive = queryIsLive === '1' || queryIsLive === 'true';
  const [showSkipIntro, setShowSkipIntro] = useState(!isDirectLive);
  const [showCast, setShowCast] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState('off');
  const [activeAudio, setActiveAudio] = useState('auto');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateFs = () => setIsFullscreen(isFullscreenActive());
    updateFs();
    document.addEventListener('fullscreenchange', updateFs);
    document.addEventListener('webkitfullscreenchange', updateFs);
    document.addEventListener('mozfullscreenchange', updateFs);
    document.addEventListener('MSFullscreenChange', updateFs);
    return () => {
      document.removeEventListener('fullscreenchange', updateFs);
      document.removeEventListener('webkitfullscreenchange', updateFs);
      document.removeEventListener('mozfullscreenchange', updateFs);
      document.removeEventListener('MSFullscreenChange', updateFs);
    };
  }, []);

  const [tracks, setTracks] = useState<MediaTracksData>({ audioTracks: [], subtitleTracks: [], qualities: [] });
  const [isLive, setIsLive] = useState(isDirectLive);
  const [nextNode, setNextNode] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimer = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Amélioration gestion du titre réel du média et des chapitres d'intro
  const [resolvedTitle, setResolvedTitle] = useState<string>(title || '');
  const [introChapter, setIntroChapter] = useState<{ start: number; end: number } | null>(null);

  // Gestion de la discussion en direct, appel vocal & mode silence
  const [viewersCount, setViewersCount] = useState<number>(1);
  const [activeSession, setActiveSession] = useState<MediaSession | null>(null);
  const activeSessionRef = useRef<MediaSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (id) {
      fetchMediaDetail(String(id), share).then((res) => {
        if (res?.media) {
          const badge = res.media.displayBadge || res.media.seasonEpisodeTag;
          setResolvedTitle(badge ? `${res.media.title} (${badge})` : res.media.title);
          const isChannel = res.media.nodeType === 'LIVE_CHANNEL' || Boolean(res.media.streamUrl) || isDirectLive;
          setIsLive(isChannel);

          if (isChannel) {
            setShowSkipIntro(false);
            setIntroChapter(null);
            setInitialTime(0);
          } else {
            const chapters = res.media.chaptersJson || [];
            const foundIntro = chapters.find((ch: any) => ch.type === 'INTRO');
            if (foundIntro) {
              setIntroChapter({ start: foundIntro.startSeconds, end: foundIntro.endSeconds });
              setShowSkipIntro(true);
            } else {
              setIntroChapter(null);
            }

            if (res.media.positionSeconds && res.media.positionSeconds > 10 && !res.media.isCompleted) {
              savedPosRef.current = res.media.positionSeconds;
              setInitialTime(res.media.positionSeconds);
              const m = Math.floor(res.media.positionSeconds / 60);
              const s = Math.floor(res.media.positionSeconds % 60);
              showToast(`Reprise de la lecture à ${m}:${String(s).padStart(2, '0')}`);
            }
          }
        }
      });
    }
  }, [id, title, share]);

  const mediaTitle = resolvedTitle || title || `Média #${id}`;
  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  }, []);

  const streamUrl = useMemo(() => {
    if (!id) return '';
    const base = getVideoStreamUrl(id, share);
    const p = new URLSearchParams();
    if (activeAudio && activeAudio !== 'auto') p.set('audio', activeAudio);
    if (share) p.set('share', share);
    const qs = p.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  }, [id, activeAudio, share]);

  useEffect(() => {
    if (id) {
      setActiveAudio('auto');
      setActiveSubtitle('off');
      fetchMediaTracks(String(id)).then((data) => {
        setTracks(data);
        if (data.defaultAudioTrack && data.defaultAudioTrack !== 'auto') {
          setActiveAudio(data.defaultAudioTrack);
        }
        if (data.defaultSubtitle && data.defaultSubtitle !== 'off') {
          setActiveSubtitle(data.defaultSubtitle);
          if (data.subtitleFallbackTriggered) {
            showToast('VOST : Sous-titres activés automatiquement');
          }
        }
      });
      isCancelledRef.current = false;
      setCountdown(null);
      fetchNextMedia(String(id)).then(setNextNode);
    }
  }, [id, showToast]);

  // Surveillance de la présence et des séances communautaires (uniquement pour VOD / contenus planifiés)
  useEffect(() => {
    if (!id || isLive) return;
    const updatePresence = async () => {
      // Signaler la progression en base (uniquement pour films/séries VOD)
      if (savedPosRef.current > 0) {
        reportPlaybackProgress(String(id), savedPosRef.current || 0, 0, true);
      }

      const res = await fetchMediaSessions(String(id));
      setViewersCount(Math.max(1, res.totalViewers));
      if (res.sessions.length > 0) {
        setActiveSession(res.sessions[0]);
        activeSessionRef.current = res.sessions[0];
        // Ping l'état vocal si une séance existe
        pingSession(res.sessions[0].id, { isMuted });
      } else {
        setActiveSession(null);
        activeSessionRef.current = null;
      }
    };
    updatePresence();
    const timer = setInterval(updatePresence, 3000);
    return () => {
      clearInterval(timer);
      leavePlayback(String(id));
      if (activeSessionRef.current) {
        leaveSession(activeSessionRef.current.id);
      }
    };
  }, [id, isLive, isMuted]);

  // Nettoyage immédiat si l'utilisateur quitte l'onglet ou ferme la fenêtre
  useEffect(() => {
    if (typeof window === 'undefined' || !id || isLive) return;
    const handleUnload = () => {
      leavePlayback(String(id));
      if (activeSessionRef.current) {
        leaveSession(activeSessionRef.current.id);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [id, isLive]);

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

  const handlePlayNext = useCallback(() => {
    if (!nextNode) return;
    setCountdown(null);
    router.replace({
      pathname: `/player/${nextNode.id}`,
      params: share ? { share, title: nextNode.title } : { title: nextNode.title },
    } as any);
  }, [nextNode, router, share]);

  const handleCancelNext = useCallback(() => {
    isCancelledRef.current = true;
    setCountdown(null);
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
    showToast('Enchaînement automatique annulé');
  }, [showToast]);

  const handleNearEnd = useCallback((remainingSec: number) => {
    if (isLive) return; // Pas d'enchaînement de fin sur un flux live
    if (nextNode && !isCancelledRef.current && countdown === null) {
      setCountdown(Math.min(remainingSec, 8));
    }
  }, [isLive, nextNode, countdown]);

  const handleVideoEnded = useCallback(() => {
    if (isLive) return;
    if (nextNode && !isCancelledRef.current) {
      handlePlayNext();
    }
  }, [isLive, nextNode, handlePlayNext]);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleTimeUpdate = useCallback((t: number) => {
    if (!isLive) {
      savedPosRef.current = t;
    }
  }, [isLive]);

  const handleSkipIntro = useCallback(() => {
    if (isLive) return;
    const target = introChapter ? introChapter.end : (videoRef.current?.currentTime || 0) + 85;
    if (videoRef.current) videoRef.current.currentTime = target;
    setShowSkipIntro(false);
    showToast('Générique passé ⏩');
  }, [isLive, introChapter, showToast]);

  useCastReceiver({
    id: String(id), mediaTitle, isPlaying, videoRef, setIsPlaying, setActiveAudio, setActiveSubtitle,
    onStop: () => goBackOrFallback(router, '/'),
    onLoad: (newId) => router.replace(`/player/${newId}`),
  });

  const isModalOpen = showAudio || showSubtitles || showShare || showCast;
  usePlayerControls({ videoRef, isPlaying, setIsPlaying, isModalOpen, activeCastTarget, showToast, isFullscreen });

  return (
    <SafeAreaView style={styles.container}>
      <VideoPlayerView
        id={String(id)}
        streamUrl={streamUrl}
        initialTime={initialTime}
        isPlaying={isPlaying}
        isLive={isLive}
        videoRef={videoRef}
        showSkipIntro={!isLive && showSkipIntro}
        intro={isLive ? null : introChapter}
        activeSubtitle={activeSubtitle}
        activeAudio={activeAudio}
        statusMessage={statusMessage}
        isFullscreen={isFullscreen}
        onSkipIntro={handleSkipIntro}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onNearEnd={handleNearEnd}
        onEnded={handleVideoEnded}
      />

      {!isFullscreen && (
        <View
          style={styles.topBar}
          {...({ dataSet: { playerTopbar: 'true' } } as any)}
        >
        <Pressable
          focusable={true}
          accessibilityRole="button"
          onPress={() => goBackOrFallback(router, '/')}
          style={({ focused }: any) => [styles.topBtn, focused && styles.topBtnFocused]}
        >
          <Text style={styles.topBtnText}>← Retour</Text>
        </Pressable>

        {/* Contrôles d'appel en direct ou vocal dès qu'au moins 2 spectateurs regardent un contenu */}
        {viewersCount >= 2 || activeSession ? (
          <Pressable
            focusable={true}
            accessibilityRole="button"
            onPress={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              showToast(nextMute ? 'Mode Silence activé' : 'Discussion en direct activée 🎙️');
            }}
            style={({ focused }: any) => [
              styles.voiceBtn,
              isMuted ? styles.voiceBtnMuted : styles.voiceBtnActive,
              focused && styles.topBtnFocused,
            ]}
          >
            <Text style={styles.voiceBtnTxt}>
              {isMuted ? '🔇 Mode Silence' : '🎙️ Entendre la discussion'} ({viewersCount} spectateur{viewersCount > 1 ? 's' : ''})
            </Text>
          </Pressable>
        ) : null}

        <Text numberOfLines={1} style={styles.headerTitle}>{mediaTitle}</Text>

        <View style={styles.rightActions}>
          <Pressable
            focusable={true}
            accessibilityRole="button"
            onPress={() => setShowShare(true)}
            style={({ focused }: any) => [styles.topBtn, focused && styles.topBtnFocused]}
          >
            <Text style={styles.topBtnText}>🔗 Partager</Text>
          </Pressable>
          <Pressable
            focusable={true}
            accessibilityRole="button"
            onPress={() => setShowCast(true)}
            style={({ focused }: any) => [
              styles.topBtn,
              activeCastTarget && styles.castActiveBtn,
              focused && styles.topBtnFocused,
            ]}
          >
            <Text style={styles.topBtnText}>{activeCastTarget ? `📡 ${activeCastTarget.name}` : '📡 Cast'}</Text>
          </Pressable>
          <Pressable
            focusable={true}
            accessibilityRole="button"
            onPress={() => setShowAudio(true)}
            style={({ focused }: any) => [styles.topBtn, focused && styles.topBtnFocused]}
          >
            <Text style={styles.topBtnText}>🔊 Audio</Text>
          </Pressable>
          <Pressable
            focusable={true}
            accessibilityRole="button"
            onPress={() => setShowSubtitles(true)}
            style={({ focused }: any) => [styles.topBtn, focused && styles.topBtnFocused]}
          >
            <Text style={styles.topBtnText}>💬 ST</Text>
          </Pressable>
          <Pressable
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Plein écran"
            onPress={() => {
              const el = typeof document !== 'undefined' ? (document.querySelector('[data-player-container="true"]') as HTMLElement) || document.documentElement : null;
              const entered = toggleFullscreen(el);
              showToast(entered ? '⛶ Plein écran' : 'Mode fenêtre');
            }}
            style={({ focused }: any) => [styles.topBtn, focused && styles.topBtnFocused]}
          >
            <Text style={styles.topBtnText}>⛶ Plein Écran</Text>
          </Pressable>
        </View>
      </View>
      )}

      {/* Netflix Binge-Watching Next Episode Overlay */}
      {countdown !== null && nextNode && (
        <View style={styles.nextOverlay}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextCountdown}>
              {nextNode.nodeType === 'MOVIE' ? 'Film suivant' : 'Épisode suivant'} dans {countdown}s...
            </Text>
            {nextNode.displayBadge || nextNode.seasonEpisodeTag ? (
              <View style={styles.nextBadge}>
                <Text style={styles.nextBadgeText}>{nextNode.displayBadge || nextNode.seasonEpisodeTag}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.nextTitle} numberOfLines={2}>{nextNode.title}</Text>
          <View style={styles.nextActions}>
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={handlePlayNext}
              style={({ focused }: any) => [styles.nextPlayBtn, focused && { borderWidth: 2, borderColor: '#ffffff' }]}
            >
              <Text style={styles.nextPlayBtnText}>▶ Regarder maintenant</Text>
            </Pressable>
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={handleCancelNext}
              style={({ focused }: any) => [styles.nextCancelBtn, focused && { borderWidth: 2, borderColor: '#ffffff' }]}
            >
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
      <PlayerShareModal
        visible={showShare}
        mediaId={String(id)}
        mediaTitle={mediaTitle}
        onClose={() => setShowShare(false)}
      />

      <CastModal
        visible={showCast}
        currentMedia={{ id: String(id), title: mediaTitle, positionSeconds: savedPosRef.current }}
        onClose={() => setShowCast(false)}
      />
    </SafeAreaView>
  );
}
