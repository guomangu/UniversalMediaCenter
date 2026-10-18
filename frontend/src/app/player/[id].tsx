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
import { playerStore, onRemoteAudioChange, onRemoteSubtitleChange } from '@/services/playerStore';
import { fetchAccountPlayback, getLocalDeviceId } from '@/services/accountSyncService';
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
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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
  const openedMediaIdRef = useRef<string | null>(null);
  const isJoiningLiveSyncRef = useRef<boolean>(false);
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

  // Détection proactive d'une session de lecture en cours sur un autre appareil du même compte
  useEffect(() => {
    if (id) {
      fetchAccountPlayback().then((remote) => {
        if (remote && remote.mediaId === String(id) && remote.deviceId !== getLocalDeviceId()) {
          const now = Date.now();
          if (now - remote.updatedAt < 30_000) {
            isJoiningLiveSyncRef.current = true;
            if (remote.positionSeconds > 0) {
              setInitialTime(remote.positionSeconds);
              savedPosRef.current = remote.positionSeconds;
              if (videoRef.current && Math.abs(videoRef.current.currentTime - remote.positionSeconds) > 1.5) {
                videoRef.current.currentTime = remote.positionSeconds;
              }
            }
            if (remote.isPlaying !== undefined) {
              setIsPlaying(remote.isPlaying);
            }
            if (remote.activeAudio && remote.activeAudio !== 'auto') {
              setActiveAudio(remote.activeAudio);
            }
            if (remote.activeSubtitle && remote.activeSubtitle !== 'off') {
              setActiveSubtitle(remote.activeSubtitle);
            }
            showToast(`Synchronisé avec la lecture en cours sur votre compte 🔗`);
          }
        }
      }).catch(() => {});
    }
  }, [id, showToast]);

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
            const intro = chapters.find(
              (c: any) =>
                c.title &&
                (c.title.toLowerCase().includes('intro') ||
                  c.title.toLowerCase().includes('opening') ||
                  c.title.toLowerCase().includes('générique') ||
                  c.title.toLowerCase().includes('generique'))
            );
            if (intro) {
              setIntroChapter({ start: intro.start, end: intro.end });
            }

            // Ne pas écraser la position si on a rejoint une synchronisation en direct
            if (!isJoiningLiveSyncRef.current) {
              const cur = parsedJoinTime ?? (res.media.progress?.positionSeconds || 0);
              const dur = res.media.progress?.durationSeconds || res.media.runtimeSeconds || 0;
              if (cur > 10 && dur > 60 && (dur - cur > 30)) {
                setInitialTime(cur);
                savedPosRef.current = cur;
                setShowRestartBtn(true);
              } else if (cur >= dur - 30 && dur > 60) {
                setInitialTime(0);
                savedPosRef.current = 0;
                setShowRestartBtn(false);
              } else {
                setInitialTime(cur);
                savedPosRef.current = cur;
                setShowRestartBtn(false);
              }
            }
          }
        }
      });
    }
  }, [id, share, queryIsLive, parsedJoinTime]);

  useEffect(() => {
    if (showRestartBtn) {
      const timer = setTimeout(() => {
        setShowRestartBtn(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showRestartBtn]);

  const handleRestartFromBeginning = useCallback(() => {
    isJoiningLiveSyncRef.current = false;
    setShowRestartBtn(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    savedPosRef.current = 0;
    setInitialTime(0);
    playerStore.seekTo(0, true, true);
    showToast('Lecture recommencée depuis le début ⏮');
  }, [showToast]);

  const mediaTitle = resolvedTitle || title || `Média #${id}`;

  // Calcul d'URL de flux dynamique : HLS on-the-fly si format non-natif, ou direct stream
  const streamUrl = useMemo(() => {
    if (!id || isForbidden) return '';
    const useHls = Boolean(tracks?.requiresHls);
    const base = getVideoStreamUrl(id, share, useHls);
    const p = new URLSearchParams();
    if (activeAudio && activeAudio !== 'auto') p.set('audio', activeAudio);
    if (share) p.set('share', share);
    const qs = p.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  }, [id, activeAudio, share, isForbidden, tracks?.requiresHls]);

  // Synchronisation descendante univoque depuis les flux distants (Cast ou appareil du compte)
  // Utilise un canal d'événements sans boucle de dépendances réactives pour éliminer tout risque d'exceeded update depth
  useEffect(() => {
    const unsubAudio = onRemoteAudioChange((remoteAudio) => {
      setActiveAudio((cur) => (cur !== remoteAudio ? remoteAudio : cur));
    });
    const unsubSub = onRemoteSubtitleChange((remoteSub) => {
      setActiveSubtitle((cur) => (cur !== remoteSub ? remoteSub : cur));
    });
    return () => {
      unsubAudio();
      unsubSub();
    };
  }, []);

  // Initialisation unique du playerStore pour ce média (zéro ré-ouverture intempestive en boucle)
  useEffect(() => {
    if (id && resolvedTitle && streamUrl && !isForbidden && !isCorrupted) {
      if (openedMediaIdRef.current !== String(id)) {
        openedMediaIdRef.current = String(id);
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
          isRemoteSync: isJoiningLiveSyncRef.current,
        });
      }
    }
  }, [id, resolvedTitle, streamUrl, isForbidden, isCorrupted, mediaTitle, resolvedSlug, isLive, activeAudio, activeSubtitle, initialTime]);

  useEffect(() => {
    if (id && !isForbidden) {
      fetchMediaTracks(String(id), share).then((data) => {
        setTracks(data);
        if (data.defaultAudioTrack && data.defaultAudioTrack !== 'auto' && !isJoiningLiveSyncRef.current) {
          setActiveAudio(data.defaultAudioTrack);
          playerStore.setAudio(data.defaultAudioTrack, false);
        }
        if (data.defaultSubtitle && data.defaultSubtitle !== 'off' && !isJoiningLiveSyncRef.current) {
          setActiveSubtitle(data.defaultSubtitle);
          playerStore.setSubtitle(data.defaultSubtitle, false);
        }
      });
      fetchNextMedia(String(id)).then(setNextNode);
    }
  }, [id, isForbidden, share]);

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
      if (typeof document !== 'undefined' && document.hidden) return;
      if (savedPosRef.current > 0) {
        reportPlaybackProgress(String(id), savedPosRef.current || 0, 0, true);
      }

      const res = await fetchMediaSessions(String(id));
      const nextCount = Math.max(1, res.totalViewers);
      setViewersCount((prev) => (prev === nextCount ? prev : nextCount));
      if (res.sessions.length > 0) {
        const nextSession = res.sessions[0];
        if (
          !activeSessionRef.current ||
          activeSessionRef.current.id !== nextSession.id ||
          activeSessionRef.current.topicSlug !== nextSession.topicSlug
        ) {
          setActiveSession(nextSession);
        }
        activeSessionRef.current = nextSession;
        pingSession(nextSession.id, { isMuted: isMutedRef.current });
      } else {
        if (activeSessionRef.current !== null) {
          setActiveSession(null);
        }
        activeSessionRef.current = null;
      }
    };
    updatePresence();
    const timer = setInterval(updatePresence, 5000);
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
    if (playerStore.isApplyingRemoteSync()) {
      return;
    }
    const isPassiveFollower = isJoiningLiveSyncRef.current;
    playerStore.setPlaying(true, true, !isPassiveFollower);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (!isLeavingScreenRef.current) {
      if (playerStore.isApplyingRemoteSync()) {
        return;
      }
      const isPassiveFollower = isJoiningLiveSyncRef.current;
      playerStore.setPlaying(false, true, !isPassiveFollower);
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
    isJoiningLiveSyncRef.current = false;
    const target = introChapter ? introChapter.end : (videoRef.current?.currentTime || 0) + 85;
    if (videoRef.current) videoRef.current.currentTime = target;
    setShowSkipIntro(false);
    playerStore.seekTo(target, true, true);
    showToast('Générique passé ⏭');
  }, [isLive, introChapter, showToast]);

  useCastReceiver({
    id: String(id),
    mediaTitle,
    isPlaying: isForbidden ? false : isPlaying,
    videoRef,
    setIsPlaying,
    setActiveAudio: (audio) => {
      setActiveAudio(audio);
      playerStore.setAudio(audio, false);
    },
    setActiveSubtitle: (sub) => {
      setActiveSubtitle(sub);
      playerStore.setSubtitle(sub, false);
    },
    onStop: () => goBackOrFallback(router, '/'),
    onLoad: (newId, payload) => {
      const pos = payload?.positionSeconds ? Math.floor(payload.positionSeconds) : 0;
      router.replace({
        pathname: `/player/${newId}`,
        params: { joinTime: String(pos), title: payload?.title || '' },
      } as any);
    },
  });

  const isAnyModalOpen = Boolean(showAudio || showSubtitles || showShare || showCast || showRepost || showMenuModal);

  usePlayerControls({
    videoRef,
    isPlaying: isForbidden ? false : isPlaying,
    isFullscreen,
    isModalOpen: isAnyModalOpen,
    activeCastTarget,
    setIsPlaying,
    showToast,
    onUserAction: () => {
      isJoiningLiveSyncRef.current = false;
    },
  });

  const activeAudioLabel = useMemo(() => {
    if (activeAudio === 'auto') return 'Automatique';
    const track = tracks.audioTracks.find((t) => String(t.index) === String(activeAudio));
    return track ? track.label : `Piste #${activeAudio}`;
  }, [activeAudio, tracks.audioTracks]);

  const activeSubtitleLabel = useMemo(() => {
    if (activeSubtitle === 'off') return 'Désactivés';
    const track = tracks.subtitleTracks.find((s) => (s.fileName ? `file:${s.fileName}` : `track:${s.index}`) === activeSubtitle);
    return track ? track.label : `Sous-titre #${activeSubtitle}`;
  }, [activeSubtitle, tracks.subtitleTracks]);

  if (isForbidden) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorIcon}>🔒</Text>
        <Text style={styles.errorTitle}>Accès Restreint</Text>
        <Text style={styles.errorSubtitle}>
          {forbiddenReason || "Ce média n'est pas autorisé pour votre profil (contrôle parental ou dossier restreint)."}
        </Text>
        <Pressable
          focusable={true}
          accessibilityRole="button"
          onPress={() => goBackOrFallback(router, '/')}
          style={({ focused }: any) => [styles.backBtn, focused && { borderWidth: 2, borderColor: '#ffffff' }]}
        >
          <Text style={styles.backBtnText}>← Retour à l'accueil</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isCorrupted) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Média Non Lisible</Text>
        <Text style={styles.errorSubtitle}>{corruptedReason}</Text>
        <Pressable
          focusable={true}
          accessibilityRole="button"
          onPress={() => goBackOrFallback(router, '/')}
          style={({ focused }: any) => [styles.backBtn, focused && { borderWidth: 2, borderColor: '#ffffff' }]}
        >
          <Text style={styles.backBtnText}>← Retour à l'accueil</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#94a3b8', fontSize: 13 }}>Chargement de la lecture...</Text>
      </View>
    </SafeAreaView>
  );
}
