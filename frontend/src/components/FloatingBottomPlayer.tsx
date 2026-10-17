import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, Platform, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { playerStore, usePlayerState } from '@/services/playerStore';
import { useActiveCastTarget, disconnectCastTotally } from '@/services/castState';
import { sendCastCommand } from '@/services/castService';
import { resolveImageUrl } from '@/services/api';
import { fetchMediaTracks, MediaTracksData } from '@/services/mediaTracksApi';
import { PlayerSubtitleModal } from './PlayerSubtitleModal';
import { PlayerAudioModal } from './PlayerAudioModal';
import { CastModal } from './CastModal';
import { styles } from './FloatingBottomPlayer.styles';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const FloatingBottomPlayer: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const playerState = usePlayerState();
  const activeCastTarget = useActiveCastTarget();

  const [tracks, setTracks] = useState<MediaTracksData>({ audioTracks: [], subtitleTracks: [], qualities: [] });
  const [showSubModal, setShowSubModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showCastModal, setShowCastModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeMedia = playerState.activeMedia;
  const lastPlayback = playerState.lastPlayback;

  // Si l'utilisateur est déjà sur l'écran /player, ne pas afficher le mini-lecteur flottant
  const isOnPlayerScreen = pathname?.startsWith('/player');

  // Chargement des pistes audio et sous-titres dès qu'un média est actif
  useEffect(() => {
    if (activeMedia?.id) {
      fetchMediaTracks(activeMedia.id).then(setTracks).catch(() => {});
    }
  }, [activeMedia?.id]);

  // Si nous sommes sur /player, masquer player_div pour éviter tout doublon
  if (isOnPlayerScreen) {
    return null;
  }

  // Si aucun média n'est actif et aucun dernier visionnage disponible
  if (!activeMedia && !lastPlayback && !activeCastTarget) {
    return null;
  }

  // Cas 1 : Aucune lecture en cours, mais reprise disponible (Style YouTube)
  if (!activeMedia && !activeCastTarget && lastPlayback) {
    const posterUri = resolveImageUrl(lastPlayback.posterUrl);
    return (
      <View
        nativeID="player_div"
        {...({ id: 'player_div', 'data-player-div': 'true' } as any)}
        style={styles.container}
      >
        <View style={styles.resumeBar}>
          <View style={styles.resumeLeft}>
            {posterUri ? (
              <View style={styles.posterThumb}>
                <Image source={{ uri: posterUri }} style={styles.posterImg} resizeMode="cover" />
              </View>
            ) : (
              <Text style={styles.resumeIcon}>🍿</Text>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.resumeTitle} numberOfLines={1}>
                Reprendre : {lastPlayback.title}
              </Text>
              <Text style={styles.resumeSub}>
                Position : {formatTime(lastPlayback.positionSeconds)}
                {lastPlayback.durationSeconds > 0 ? ` / ${formatTime(lastPlayback.durationSeconds)}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.resumeActions}>
            <Pressable
              focusable={true}
              style={styles.resumeBtn}
              onPress={() => {
                router.push({
                  pathname: `/player/${lastPlayback.id}`,
                  params: { joinTime: String(Math.floor(lastPlayback.positionSeconds || 0)), title: lastPlayback.title },
                } as any);
              }}
            >
              <Text style={styles.resumeBtnTxt}>▶ Reprendre</Text>
            </Pressable>
            <Pressable
              focusable={true}
              style={styles.dismissBtn}
              onPress={() => playerStore.dismissLastPlayback()}
            >
              <Text style={styles.dismissBtnTxt}>✕</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Cas 2 : Un média est en cours de lecture (localement ou en Cast)
  const isCasting = Boolean(activeCastTarget);
  const mediaTitle = activeCastTarget?.mediaTitle || activeMedia?.title || 'Média en cours';
  const pos = isCasting ? (activeCastTarget?.positionSeconds ?? 0) : (activeMedia?.positionSeconds ?? 0);
  const dur = isCasting ? (activeCastTarget?.durationSeconds ?? 0) : (activeMedia?.durationSeconds ?? 0);
  const isPlaying = isCasting ? Boolean(activeCastTarget?.isPlaying) : Boolean(activeMedia?.isPlaying);
  const posterUri = resolveImageUrl(activeMedia?.posterUrl || activeCastTarget?.posterUrl);

  const pct = dur > 0 ? (pos / dur) * 100 : 0;

  const handleBarClick = (e: any) => {
    if (Platform.OS !== 'web' || !dur) return;
    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = Math.floor(ratio * dur);
    if (isCasting && activeCastTarget) {
      sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: target });
    } else {
      playerStore.seekTo(target);
    }
  };

  const handleTogglePlay = () => {
    if (isCasting && activeCastTarget) {
      sendCastCommand(activeCastTarget.id, isPlaying ? 'PAUSE' : 'PLAY');
    } else {
      playerStore.togglePlayPause();
    }
  };

  const handleSeekRelative = (offset: number) => {
    if (isCasting && activeCastTarget) {
      const nextPos = Math.max(0, Math.min(dur || 7200, pos + offset));
      sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: nextPos });
    } else {
      playerStore.seekRelative(offset);
    }
  };

  const handleExpand = () => {
    const targetId = activeMedia?.id || activeCastTarget?.currentMediaId;
    if (targetId) {
      router.push({
        pathname: `/player/${targetId}`,
        params: { joinTime: String(Math.floor(pos)), title: mediaTitle },
      } as any);
    }
  };

  const handleClose = async () => {
    if (isCasting) {
      await disconnectCastTotally(false);
    }
    playerStore.closeMedia();
  };

  return (
    <View
      nativeID="player_div"
      {...({ id: 'player_div', 'data-player-div': 'true' } as any)}
      style={styles.container}
    >
      {/* Barre de progression scrubber interactive */}
      <Pressable style={styles.progressBarBg} onPress={handleBarClick as any}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
      </Pressable>

      <View style={styles.mainRow}>
        {/* Section gauche : Miniature et Titre */}
        <Pressable focusable={true} style={styles.leftSection} onPress={handleExpand}>
          <View style={styles.posterThumb}>
            {posterUri ? (
              <Image source={{ uri: posterUri }} style={styles.posterImg} resizeMode="cover" />
            ) : (
              <View style={styles.posterPlaceholder}>
                <Text style={styles.posterPlaceholderTxt}>▶</Text>
              </View>
            )}
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.titleText} numberOfLines={1}>
              {isCasting ? `📡 ${mediaTitle}` : mediaTitle}
            </Text>
            <Text style={styles.subText} numberOfLines={1}>
              {isCasting ? `Diffusé sur ${activeCastTarget?.name}` : activeMedia?.isLive ? '🔴 Direct' : `${formatTime(pos)} / ${formatTime(dur)}`}
            </Text>
          </View>
        </Pressable>

        {/* Section centrale : Contrôles de lecture */}
        <View style={styles.centerControls}>
          <Pressable focusable={true} style={styles.controlBtn} onPress={() => handleSeekRelative(-10)}>
            <Text style={styles.controlBtnTxt}>-10s</Text>
          </Pressable>

          <Pressable focusable={true} style={[styles.controlBtn, styles.playBtn]} onPress={handleTogglePlay}>
            <Text style={styles.playBtnTxt}>{isPlaying ? '⏸' : '▶'}</Text>
          </Pressable>

          <Pressable focusable={true} style={styles.controlBtn} onPress={() => handleSeekRelative(30)}>
            <Text style={styles.controlBtnTxt}>+30s</Text>
          </Pressable>
        </View>

        {/* Section droite : Fonctions responsive (Sous-titres, Audio, Cast, Agrandir, Fermer) */}
        <View style={styles.rightSection}>
          {!isMobile && (
            <>
              {/* Sélecteur de sous-titres */}
              <Pressable
                focusable={true}
                style={[styles.actionChip, activeMedia?.activeSubtitle !== 'off' && styles.actionChipActive]}
                onPress={() => setShowSubModal(true)}
              >
                <Text style={styles.actionChipTxt}>
                  💬 {activeMedia?.activeSubtitle !== 'off' ? `ST: ${activeMedia?.activeSubtitle?.toUpperCase()}` : 'ST'}
                </Text>
              </Pressable>

              {/* Sélecteur de langue / piste audio */}
              <Pressable
                focusable={true}
                style={[styles.actionChip, activeMedia?.activeAudio !== 'auto' && styles.actionChipActive]}
                onPress={() => setShowAudioModal(true)}
              >
                <Text style={styles.actionChipTxt}>
                  🔊 {activeMedia?.activeAudio && activeMedia.activeAudio !== 'auto' ? `Audio: ${activeMedia.activeAudio}` : 'Audio'}
                </Text>
              </Pressable>
            </>
          )}

          {/* Bouton Cast */}
          <Pressable
            focusable={true}
            style={[styles.actionChip, isCasting && styles.castBadge]}
            onPress={() => setShowCastModal(true)}
          >
            <Text style={styles.actionChipTxt}>
              {isCasting ? `📡 ${activeCastTarget?.name?.slice(0, 8)}` : '📡 Cast'}
            </Text>
          </Pressable>

          {/* Bouton Plein écran / Agrandir */}
          <Pressable focusable={true} style={styles.actionChip} onPress={handleExpand}>
            <Text style={styles.actionChipTxt}>⛶ Agrandir</Text>
          </Pressable>

          {/* Bouton Fermer */}
          <Pressable focusable={true} style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnTxt}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Modales de gestion audio, sous-titres et Cast intégrées */}
      {showSubModal && (
        <PlayerSubtitleModal
          visible={showSubModal}
          activeSubtitle={activeMedia?.activeSubtitle || 'off'}
          tracks={tracks.subtitleTracks}
          onSelect={(sub) => {
            playerStore.setSubtitle(sub);
          }}
          onClose={() => setShowSubModal(false)}
        />
      )}

      {showAudioModal && (
        <PlayerAudioModal
          visible={showAudioModal}
          activeAudio={activeMedia?.activeAudio || 'auto'}
          tracks={tracks.audioTracks}
          onSelect={(aud) => {
            playerStore.setAudio(aud);
          }}
          onClose={() => setShowAudioModal(false)}
        />
      )}

      {showCastModal && (
        <CastModal
          visible={showCastModal}
          currentMedia={
            activeMedia
              ? {
                  id: activeMedia.id,
                  title: activeMedia.title,
                  streamUrl: activeMedia.streamUrl,
                  posterUrl: activeMedia.posterUrl,
                  positionSeconds: activeMedia.positionSeconds,
                }
              : undefined
          }
          onClose={() => setShowCastModal(false)}
        />
      )}
    </View>
  );
};
