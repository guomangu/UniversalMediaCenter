import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CastModal } from '@/components/CastModal';
import { VideoPlayerView } from '@/components/VideoPlayerView';
import { PlayerSubtitleModal } from '@/components/PlayerSubtitleModal';
import { PlayerAudioModal } from '@/components/PlayerAudioModal';
import { PlayerShareModal } from '@/components/PlayerShareModal';
import { MediaRepostModal } from '@/components/MediaRepostModal';
import { PlayerMenuModal } from '@/components/PlayerMenuModal';
import { useCastReceiver } from '@/hooks/useCastReceiver';
import { usePlayerControls } from '@/hooks/usePlayerControls';
import { useActiveCastTarget } from '@/services/castState';
import { playerStore, usePlayerState } from '@/services/playerStore';
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
import { usePlayerVoiceCall } from '@/hooks/usePlayerVoiceCall';
import { goBackOrFallback } from '@/utils/navigation';

export default function PlayerScreen() {
  const { id, title, share, isLive: queryIsLive, joinTime, time, targetUser } = useLocalSearchParams<{
    id: string;
    title?: string;
    share?: string;
    isLive?: string;
    joinTime?: string;
    time?: string;
    targetUser?: string;
  }>();

  const rawJoinTime = joinTime !== undefined ? Number(joinTime) : time !== undefined ? Number(time) : null;
  const parsedJoinTime = rawJoinTime !== null && !isNaN(rawJoinTime) && rawJoinTime >= 0 ? rawJoinTime : null;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallMobile = width < 480;

  const playerState = usePlayerState();
  const [isPlaying, setIsPlaying] = useState(true);
  const [initialTime, setInitialTime] = useState(parsedJoinTime || 0);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showRestartBtn, setShowRestartBtn] = useState(false);
  const [introChapter, setIntroChapter] = useState<{ start: number; end: number } | null>(null);
  const [activeAudio, setActiveAudio] = useState<string>('auto');
  const [activeSubtitle, setActiveSubtitle] = useState<string>('off');
  const [isLive, setIsLive] = useState(queryIsLive === 'true');
  const [resolvedTitle, setResolvedTitle] = useState('');
  const [resolvedSlug, setResolvedSlug] = useState('');
  const [isForbidden, setIsForbidden] = useState(false);
  const [isCorrupted, setIsCorrupted] = useState(false);
  const [corruptedReason, setCorruptedReason] = useState<string>('');
  const [forbiddenReason, setForbiddenReason] = useState<string>('');

  const [showAudio, setShowAudio] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCast, setShowCast] = useState(false);
  const [showRepost, setShowRepost] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Le mode micro commence systématiquement en silence (isMuted: true)
  const [isMuted, setIsMuted] = useState(true);

  const [activeSession, setActiveSession] = useState<MediaSession | null>(null);
  const [viewersCount, setViewersCount] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const activeSessionRef = useRef<MediaSession | null>(null);

  const [nextNode, setNextNode] = useState<{
    id: string;
    title: string;
    nodeType: string;
    displayBadge?: string;
    seasonEpisodeTag?: string;
  } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const savedPosRef = useRef<number>(parsedJoinTime || 0);
  const countdownTimer = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isLeavingScreenRef = useRef<boolean>(false);
  const [tracks, setTracks] = useState<MediaTracksData>({ audioTracks: [], subtitleTracks: [], qualities: [] });

  const activeCastTarget = useActiveCastTarget();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    return () => {
      isLeavingScreenRef.current = true;
    };
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(isFullscreenActive());
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    if (id) {
      const isDirectLive = queryIsLive === 'true' || String(id).startsWith('iptv-');
      setIsLive(isDirectLive);

      fetchMediaDetail(String(id), share).then((res) => {
        if (res?.forbidden || res?.code === 'FORBIDDEN') {
          setIsForbidden(true);
          setForbiddenReason(res?.error || 'Accès non autorisé pour votre profil');
          return;
        }
        if (res && !res.media && res.error) {
          setIsForbidden(true);
          setForbiddenReason(res.error);
          return;
        }
        if (res?.media) {
          if (res.media.state === 'ERROR') {
            setIsCorrupted(true);
            setCorruptedReason('Ce fichier vidéo est incomplet ou corrompu sur le disque de stockage (téléchargement inachevé ou en-tête manquant).');
            return;
          }
          setIsCorrupted(false);
          setIsForbidden(false);
          const badge = res.media.displayBadge || res.media.seasonEpisodeTag;
          setResolvedTitle(badge ? `${res.media.title} (${badge})` : res.media.title);
          setResolvedSlug(res.media.slug || '');
          const isChannel = res.media.nodeType === 'LIVE_CHANNEL' || Boolean(res.media.streamUrl) || isDirectLive;
          setIsLive(isChannel);

          if (isChannel) {
            setShowSkipIntro(false);
            setIntroChapter(null);
            setInitialTime(0);
            setShowRestartBtn(false);
          } else {
            const chapters = res.media.chaptersJson || [];
            const foundIntro = chapters.find((ch: any) => ch.type === 'INTRO');
            if (foundIntro) {
              setIntroChapter({ start: foundIntro.startSeconds, end: foundIntro.endSeconds });
              setShowSkipIntro(true);
            } else {
              setIntroChapter(null);
            }

            if (parsedJoinTime !== null) {
              savedPosRef.current = parsedJoinTime;
              setInitialTime(parsedJoinTime);
              if (parsedJoinTime > 0) {
                setShowRestartBtn(true);
                const m = Math.floor(parsedJoinTime / 60);
                const s = Math.floor(parsedJoinTime % 60);
                showToast(
                  targetUser
                    ? `Visionnage synchronisé avec ${targetUser} à ${m}:${String(s).padStart(2, '0')}`
                    : `Visionnage synchronisé à ${m}:${String(s).padStart(2, '0')}`
                );
              }
            } else if (res.media.positionSeconds && res.media.positionSeconds > 10 && !res.media.isCompleted) {
              savedPosRef.current = res.media.positionSeconds;
              setInitialTime(res.media.positionSeconds);
              setShowRestartBtn(true);
              const m = Math.floor(res.media.positionSeconds / 60);
              const s = Math.floor(res.media.positionSeconds % 60);
              showToast(`Reprise de la lecture à ${m}:${String(s).padStart(2, '0')}`);
            }
          }
        }
      });
    }
  }, [id, title, share, joinTime, time, targetUser]);

  useEffect(() => {
    if (showRestartBtn) {
      const timer = setTimeout(() => {
        setShowRestartBtn(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showRestartBtn]);

  const handleRestartFromBeginning = useCallback(() => {
    setShowRestartBtn(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    savedPosRef.current = 0;
    setInitialTime(0);
    showToast('Lecture recommencée depuis le début ⏮');
  }, [showToast]);

  const mediaTitle = resolvedTitle || title || `Média #${id}`;

  const streamUrl = useMemo(() => {
    if (!id || isForbidden) return '';
    const base = getVideoStreamUrl(id, share);
    const p = new URLSearchParams();
    if (activeAudio && activeAudio !== 'auto') p.set('audio', activeAudio);
    if (share) p.set('share', share);
    const qs = p.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  }, [id, activeAudio, share, isForbidden]);

  useEffect(() => {
    if (resolvedTitle && streamUrl && !isForbidden && !isCorrupted) {
      playerStore.openMedia({
        id: String(id),
        title: mediaTitle,
        slug: resolvedSlug,
        posterUrl: `/api/media/${id}/poster`,
        streamUrl,
        isLive,
        activeAudio,
        activeSubtitle,
        initialTime: initialTime || 0,
      });
    }
  }, [id, resolvedTitle, streamUrl, isForbidden, isCorrupted]);

  useEffect(() => {
    if (id && !isForbidden) {
      fetchMediaTracks(String(id), share).then((data) => {
        setTracks(data);
        if (data.defaultAudioTrack && data.defaultAudioTrack !== 'auto') {
          setActiveAudio(data.defaultAudioTrack);
        }
        if (data.defaultSubtitle && data.defaultSubtitle !== 'off') {
          setActiveSubtitle(data.defaultSubtitle);
        }
      });
      fetchNextMedia(String(id)).then(setNextNode);
    }
  }, [id, isForbidden, share, showToast]);

  // Salon vocal unifié pour ce média (ou session active)
  const voiceTopicSlug = activeSession?.topicSlug || (resolvedSlug ? `media-${resolvedSlug}` : `media-${id}`);
  const isVoiceEnabled = !isForbidden && Boolean(voiceTopicSlug);
  const { isLiveSpeaking } = usePlayerVoiceCall({
    topicSlug: voiceTopicSlug,
    isMuted,
    setIsMuted,
    isEnabled: isVoiceEnabled,
    showToast,
  });

  // Surveillance de la présence et des séances communautaires
  useEffect(() => {
    if (!id || isLive || isForbidden) return;
    const updatePresence = async () => {
      if (savedPosRef.current > 0) {
        reportPlaybackProgress(String(id), savedPosRef.current || 0, 0, true);
      }

      const res = await fetchMediaSessions(String(id));
      setViewersCount(Math.max(1, res.totalViewers));
      if (res.sessions.length > 0) {
        setActiveSession(res.sessions[0]);
        activeSessionRef.current = res.sessions[0];
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
  }, [id, isLive, isForbidden]);

  // Compte à rebours automatique Next Netflix
  useEffect(() => {
    if (countdown === null || isForbidden) return;
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
  }, [countdown, nextNode, isForbidden]);

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
    if (isLive || isForbidden) return;
    if (nextNode && !isCancelledRef.current && countdown === null) {
      setCountdown(Math.min(remainingSec, 8));
    }
  }, [isLive, nextNode, countdown, isForbidden]);

  const handleVideoEnded = useCallback(() => {
    if (isLive || isForbidden) return;
    if (nextNode && !isCancelledRef.current) {
      handlePlayNext();
    }
  }, [isLive, nextNode, handlePlayNext, isForbidden]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    playerStore.setPlaying(true);
  }, []);
  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (!isLeavingScreenRef.current) {
      playerStore.setPlaying(false);
    }
  }, []);
  const handleTimeUpdate = useCallback((t: number, d?: number) => {
    if (!isLive) {
      savedPosRef.current = t;
    }
    playerStore.updateProgress(t, d || 0);
  }, [isLive]);

  const handleSkipIntro = useCallback(() => {
    if (isLive) return;
    const target = introChapter ? introChapter.end : (videoRef.current?.currentTime || 0) + 85;
    if (videoRef.current) videoRef.current.currentTime = target;
    setShowSkipIntro(false);
    showToast('Générique passé ⏩');
  }, [isLive, introChapter, showToast]);

  useCastReceiver({
    id: String(id),
    mediaTitle,
    isPlaying: isForbidden ? false : isPlaying,
    videoRef,
    setIsPlaying,
    setActiveAudio,
    setActiveSubtitle,
    onStop: () => goBackOrFallback(router, '/'),
    onLoad: (newId, payload) => {
      const pos = payload?.positionSeconds ? Math.floor(payload.positionSeconds) : 0;
      router.replace({
        pathname: `/player/${newId}`,
        params: pos > 0 ? { joinTime: String(pos) } : undefined,
      } as any);
    },
  });

  const isModalOpen = showAudio || showSubtitles || showShare || showCast || showRepost || showMenuModal;
  usePlayerControls({ videoRef, isPlaying: isForbidden ? false : isPlaying, setIsPlaying, isModalOpen, activeCastTarget, showToast, isFullscreen });

  // Libellés pour le menu d'options
  const activeAudioLabel = useMemo(() => {
    if (!activeAudio || activeAudio === 'auto') return 'Auto';
    const found = tracks.audioTracks.find((t) => String(t.index) === String(activeAudio));
    return found ? found.label : `Piste #${activeAudio}`;
  }, [activeAudio, tracks.audioTracks]);

  const activeSubtitleLabel = useMemo(() => {
    if (!activeSubtitle || activeSubtitle === 'off') return 'Désactivé';
    const found = tracks.subtitleTracks.find((s) => {
      const val = s.fileName ? `file:${s.fileName}` : `track:${s.index}`;
      return val === activeSubtitle;
    });
    return found ? found.label : activeSubtitle;
  }, [activeSubtitle, tracks.subtitleTracks]);

  if (isCorrupted) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000000' }]}>
        <View
          style={{
            maxWidth: 500,
            width: '100%',
            backgroundColor: '#0a0a0a',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#f59e0b',
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>
            Fichier Incomplet ou Corrompu
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            {corruptedReason || 'Ce fichier vidéo est incomplet sur le disque de stockage (téléchargement inachevé ou en-tête manquant). Veuillez terminer le téléchargement ou remplacer le fichier source.'}
          </Text>
          <Pressable
            focusable={true}
            onPress={() => goBackOrFallback(router, '/')}
            style={({ focused }: any) => [
              {
                backgroundColor: '#3b82f6',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                alignItems: 'center',
              },
              focused && { borderWidth: 2, borderColor: '#ffffff' },
            ]}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
              ← Retour au catalogue
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isForbidden) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000000' }]}>
        <View
          style={{
            maxWidth: 480,
            width: '100%',
            backgroundColor: '#0a0a0a',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#ef4444',
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🚫</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>
            Contenu Bloqué
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            {forbiddenReason || 'Ce média est restreint par les règles de contrôle parental ou les autorisations de votre profil.'}
          </Text>
          <Pressable
            focusable={true}
            onPress={() => goBackOrFallback(router, '/')}
            style={({ focused }: any) => [
              {
                backgroundColor: '#3b82f6',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                alignItems: 'center',
              },
              focused && { borderWidth: 2, borderColor: '#ffffff' },
            ]}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
              Retour à l'accueil
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
        statusMessage={toastMessage || undefined}
        isFullscreen={isFullscreen}
        onSkipIntro={handleSkipIntro}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onNearEnd={handleNearEnd}
        onEnded={handleVideoEnded}
      />

      {/* Barre supérieure ergonomique, épurée et rationnelle */}
      <View style={styles.topBar}>
        <View style={styles.leftActions}>
          <Pressable
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => {
              isLeavingScreenRef.current = true;
              const cur = videoRef.current?.currentTime;
              if (typeof cur === 'number' && cur >= 0) {
                playerStore.updateProgress(cur, videoRef.current?.duration || 0);
              }
              if (isPlaying) {
                playerStore.setPlaying(true);
              }
              goBackOrFallback(router, '/');
            }}
            style={({ focused }: any) => [styles.topBtn, focused && styles.topBtnFocused]}
          >
            <Text style={styles.topBtnText}>{isSmallMobile ? '←' : '← Retour'}</Text>
          </Pressable>

          <Pressable
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Réduire en bas d'écran"
            onPress={() => {
              isLeavingScreenRef.current = true;
              playerStore.setMinimized(true);
              const cur = videoRef.current?.currentTime;
              if (typeof cur === 'number' && cur >= 0) {
                playerStore.updateProgress(cur, videoRef.current?.duration || 0);
              }
              if (isPlaying) {
                playerStore.setPlaying(true);
              }
              goBackOrFallback(router, '/');
            }}
            style={({ focused }: any) => [styles.topBtn, focused && styles.topBtnFocused]}
          >
            <Text style={styles.topBtnText}>{isSmallMobile ? '▼' : '▼ Réduire'}</Text>
          </Pressable>
        </View>

        <Text numberOfLines={1} style={styles.headerTitle}>{mediaTitle}</Text>

        <View style={styles.rightActions}>
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
            <Text style={styles.topBtnText}>⛶</Text>
          </Pressable>

          <Pressable
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Menu Options"
            onPress={() => setShowMenuModal(true)}
            style={({ focused }: any) => [styles.menuBtn, focused && styles.menuBtnFocused]}
          >
            <Text style={styles.menuBtnText}>⚙️ Menu</Text>
          </Pressable>
        </View>
      </View>

      {/* Toast d'information éphémère */}
      {toastMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Bouton d'action "Recommencer depuis le début" */}
      {showRestartBtn && (
        <Pressable
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Recommencer depuis le début"
          onPress={handleRestartFromBeginning}
          style={({ focused }: any) => [
            styles.restartBtn,
            focused && styles.restartBtnFocused,
          ]}
        >
          <Text style={styles.restartBtnIcon}>⏮</Text>
          <Text style={styles.restartBtnText}>Recommencer</Text>
        </Pressable>
      )}

      {/* Bouton "Passer l'intro" pour les animes/séries TV */}
      {showSkipIntro && !isLive && (
        <Pressable
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Passer le générique d'introduction"
          onPress={handleSkipIntro}
          style={({ focused }: any) => [styles.skipBtn, focused && styles.skipBtnFocused]}
        >
          <Text style={styles.skipText}>Passer l'intro ⏩</Text>
        </Pressable>
      )}

      {/* Compte à rebours automatique Next Netflix */}
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
        onSelect={(val) => {
          setActiveAudio(val);
          setShowAudio(false);
          const found = tracks.audioTracks.find((t) => String(t.index) === String(val));
          showToast(`Piste audio : ${found ? found.label : val === 'auto' ? 'Auto' : val} 🔊`);
        }}
        onClose={() => setShowAudio(false)}
      />

      <PlayerSubtitleModal
        visible={showSubtitles}
        tracks={tracks.subtitleTracks}
        activeSubtitle={activeSubtitle}
        onSelect={(val) => {
          setActiveSubtitle(val);
          setShowSubtitles(false);
          const found = tracks.subtitleTracks.find((s) => (s.fileName ? `file:${s.fileName}` : `track:${s.index}`) === val);
          showToast(`Sous-titres : ${found ? found.label : val === 'off' ? 'Désactivés' : val} 💬`);
        }}
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
        currentMedia={{ id: String(id), title: mediaTitle, positionSeconds: savedPosRef.current, streamUrl }}
        onClose={() => setShowCast(false)}
        onCastStarted={() => {
          videoRef.current?.pause?.();
          setIsPlaying(false);
          showToast('Diffusion en cours sur l’écran distant 📡');
        }}
      />

      <MediaRepostModal
        visible={showRepost}
        mediaId={String(id)}
        mediaTitle={mediaTitle}
        onClose={() => setShowRepost(false)}
        onSuccess={() => showToast('✨ Avis & repost publié !')}
      />

      <PlayerMenuModal
        visible={showMenuModal}
        mediaTitle={mediaTitle}
        activeCastTarget={activeCastTarget}
        activeAudioLabel={activeAudioLabel}
        activeSubtitleLabel={activeSubtitleLabel}
        isVoiceMuted={isMuted}
        viewersCount={viewersCount}
        isLiveSpeaking={isLiveSpeaking}
        onToggleVoiceMute={() => {
          const next = !isMuted;
          setIsMuted(next);
          showToast(next ? 'Microphone désactivé 🎙️' : 'Discussion vocale activée (micro ouvert) 🎙️');
        }}
        onOpenRepost={() => setShowRepost(true)}
        onOpenShare={() => setShowShare(true)}
        onOpenCast={() => setShowCast(true)}
        onOpenAudio={() => setShowAudio(true)}
        onOpenSubtitles={() => setShowSubtitles(true)}
        onToggleFullscreen={() => {
          const el = typeof document !== 'undefined' ? (document.querySelector('[data-player-container="true"]') as HTMLElement) || document.documentElement : null;
          const entered = toggleFullscreen(el);
          showToast(entered ? '⛶ Plein écran' : 'Mode fenêtre');
        }}
        onClose={() => setShowMenuModal(false)}
      />
    </SafeAreaView>
  );
}
