import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playerStore } from '@/services/playerStore';
import { useCurrentUser } from '@/services/authStore';
import { fetchAccountPlayback, getLocalDeviceId } from '@/services/accountSyncService';
import { fetchMediaTracks } from '@/services/mediaTracksApi';
import { getVideoStreamUrl, fetchMediaDetail } from '@/services/api';
import { styles } from '@/components/PlayerScreen.styles';
import { goBackOrFallback } from '@/utils/navigation';

export default function PlayerScreen() {
  const { id, title, share, isLive: queryIsLive, joinTime, time } = useLocalSearchParams<{
    id: string;
    title?: string;
    share?: string;
    isLive?: string;
    joinTime?: string;
    time?: string;
  }>();

  const rawJoinTime = joinTime !== undefined ? Number(joinTime) : time !== undefined ? Number(time) : null;
  const parsedJoinTime = rawJoinTime !== null && !isNaN(rawJoinTime) && rawJoinTime >= 0 ? rawJoinTime : null;
  const router = useRouter();
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (!currentUser && !share) {
      router.replace({
        pathname: '/login',
        params: { returnUrl: `/player/${id}` },
      } as any);
    }
  }, [currentUser, share, id]);

  const [initialTime, setInitialTime] = useState(parsedJoinTime || 0);
  const [resolvedTitle, setResolvedTitle] = useState('');
  const [resolvedSlug, setResolvedSlug] = useState('');
  const [isForbidden, setIsForbidden] = useState(false);
  const [isCorrupted, setIsCorrupted] = useState(false);
  const [corruptedReason, setCorruptedReason] = useState<string>('');
  const [forbiddenReason, setForbiddenReason] = useState<string>('');
  const [isLive, setIsLive] = useState(queryIsLive === 'true');

  const openedMediaIdRef = useRef<string | null>(null);
  const isJoiningLiveSyncRef = useRef<boolean>(false);
  const [tracks, setTracks] = useState<{ requiresHls?: boolean; defaultAudioTrack?: string; defaultSubtitle?: string }>({});

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur?.();
      }
    };
  }, []);

  // Détection proactive d'une session de lecture en cours sur un autre appareil du même compte
  useEffect(() => {
    if (!currentUser && !share) return;
    if (id) {
      fetchAccountPlayback().then((remote) => {
        if (remote && remote.mediaId === String(id) && remote.deviceId !== getLocalDeviceId()) {
          const now = Date.now();
          if (now - remote.updatedAt < 30_000) {
            isJoiningLiveSyncRef.current = true;
            if (remote.positionSeconds > 0) {
              setInitialTime(remote.positionSeconds);
            }
          }
        }
      }).catch(() => {});
    }
  }, [id]);

  // Synchronisation dynamique si un joinTime est injecté ou mis à jour via navigation/cast
  useEffect(() => {
    if (parsedJoinTime !== null && parsedJoinTime >= 0) {
      setInitialTime(parsedJoinTime);
      const curMedia = playerStore.getState().activeMedia;
      if (curMedia && curMedia.id === String(id) && Math.abs(curMedia.positionSeconds - parsedJoinTime) > 1.5) {
        playerStore.seekTo(parsedJoinTime, false, false);
      }
    }
  }, [parsedJoinTime, id]);

  useEffect(() => {
    if (!currentUser && !share) return;
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

          if (!isChannel && !isJoiningLiveSyncRef.current) {
            if (parsedJoinTime !== null && parsedJoinTime >= 0) {
              setInitialTime(parsedJoinTime);
            } else {
              const cur = res.media.progress?.positionSeconds || 0;
              const dur = res.media.progress?.durationSeconds || res.media.runtimeSeconds || 0;
              if (cur > 10 && dur > 60 && dur - cur > 30) {
                setInitialTime(cur);
              } else if (cur >= dur - 30 && dur > 60) {
                setInitialTime(0);
              } else {
                setInitialTime(cur);
              }
            }
          }
        }
      });
    }
  }, [id, share, queryIsLive, parsedJoinTime]);

  useEffect(() => {
    if (!currentUser && !share) return;
    if (id && !isForbidden) {
      fetchMediaTracks(String(id), share).then((data) => {
        setTracks(data);
      });
    }
  }, [id, isForbidden, share]);

  const mediaTitle = resolvedTitle || title || `Média #${id}`;

  // Calcul d'URL de flux dynamique : HLS on-the-fly si format non-natif, ou direct stream
  const streamUrl = React.useMemo(() => {
    if (!id || isForbidden) return '';
    const useHls = Boolean(tracks?.requiresHls);
    const base = getVideoStreamUrl(id, share, useHls);
    return base;
  }, [id, share, isForbidden, tracks?.requiresHls]);

  // Initialisation unique du playerStore pour ce média dans le lecteur universel autonome
  useEffect(() => {
    if (!currentUser && !share) return;
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
          activeAudio: tracks.defaultAudioTrack || 'auto',
          activeSubtitle: tracks.defaultSubtitle || 'off',
          initialTime: initialTime || 0,
          isRemoteSync: isJoiningLiveSyncRef.current,
          expand: true,
        });
      }
    }
  }, [id, resolvedTitle, streamUrl, isForbidden, isCorrupted, mediaTitle, resolvedSlug, isLive, tracks, initialTime]);

  // Si déconnecté sans token public, redirection immédiate et aucun rendu
  if (!currentUser && !share) {
    return null;
  }

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
          onPress={() => {
            if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
              (document.activeElement as HTMLElement).blur?.();
            }
            goBackOrFallback(router, '/');
          }}
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
          onPress={() => {
            if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
              (document.activeElement as HTMLElement).blur?.();
            }
            goBackOrFallback(router, '/');
          }}
          style={({ focused }: any) => [styles.backBtn, focused && { borderWidth: 2, borderColor: '#ffffff' }]}
        >
          <Text style={styles.backBtnText}>← Retour à l'accueil</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Le lecteur autonome FloatingBottomPlayer en racine (_layout.tsx) s'occupe du rendu permanent
  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}
