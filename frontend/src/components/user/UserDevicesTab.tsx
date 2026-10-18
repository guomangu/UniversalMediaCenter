import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import {
  fetchUserDevices,
  renameUserDevice,
  disconnectRemoteDevice,
  disconnectAllOtherDevices,
  sendDeviceCommand,
  setDeviceSyncGroup,
  broadcastMediaToDevices,
  getLocalDeviceId,
  getLocalSyncGroupId,
  setLocalSyncGroupId,
  UserConnectedDevice,
} from '@/services/userDeviceService';
import { playerStore } from '@/services/playerStore';
import { searchMedia } from '@/services/api';

function formatTime(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function getDeviceIcon(deviceType: string): string {
  switch (deviceType) {
    case 'TV':
      return '📺';
    case 'MOBILE':
      return '📱';
    case 'DESKTOP':
    case 'BROWSER':
      return '💻';
    case 'CHROMECAST':
    case 'AIRPLAY':
      return '📡';
    default:
      return '🖥️';
  }
}

export function UserDevicesTab() {
  const router = useRouter();
  const [devices, setDevices] = useState<UserConnectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState(getLocalDeviceId());
  const [localSyncGroup, setLocalSyncGroupState] = useState(getLocalSyncGroupId());
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Modal / Sélecteur de diffusion groupée
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [broadcastQuery, setBroadcastQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const loadDevices = async () => {
    try {
      const data = await fetchUserDevices();
      setDevices(data.devices);
      setCurrentDeviceId(data.currentDeviceId);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 2500);
    return () => clearInterval(interval);
  }, []);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRename = async (dev: UserConnectedDevice) => {
    const currentName = dev.customName || dev.name;
    const newName = Platform.OS === 'web' ? window.prompt('Nouveau nom pour cet appareil :', currentName) : null;
    if (newName && newName.trim() && newName.trim() !== currentName) {
      const ok = await renameUserDevice(dev.deviceId, newName.trim());
      if (ok) {
        showNotification(`Appareil renommé en « ${newName.trim()} »`);
        loadDevices();
      }
    }
  };

  const handleDisconnect = async (dev: UserConnectedDevice) => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(
            `Êtes-vous sûr de vouloir déconnecter à distance l'appareil « ${dev.customName || dev.name} » ?
Sa session sera immédiatement fermée.`
          )
        : true;
    if (!confirmed) return;

    const ok = await disconnectRemoteDevice(dev.deviceId);
    if (ok) {
      showNotification(`« ${dev.customName || dev.name} » a été déconnecté à distance.`);
      loadDevices();
    }
  };

  const handleDisconnectAllOthers = async () => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(
            `Sécurité : Êtes-vous sûr de vouloir déconnecter TOUS les autres appareils connectés à votre compte ?\nSeul cet écran restera actif.`
          )
        : true;
    if (!confirmed) return;

    const res = await disconnectAllOtherDevices();
    if (res.success) {
      showNotification(`Sécurité : ${res.revokedCount ?? 0} autre(s) appareil(s) déconnecté(s).`);
      loadDevices();
    }
  };

  const handleToggleLocalSolo = async () => {
    const nextMode = localSyncGroup === 'standalone' ? 'default' : 'standalone';
    setLocalSyncGroupId(nextMode);
    setLocalSyncGroupState(nextMode);
    await setDeviceSyncGroup(currentDeviceId, nextMode);
    showNotification(
      nextMode === 'standalone'
        ? 'Mode Indépendant (Solo) activé sur cet appareil.'
        : 'Mode Synchronisé (Groupe Principal) activé sur cet appareil.'
    );
    loadDevices();
  };

  const handleToggleDeviceSyncMode = async (dev: UserConnectedDevice) => {
    const nextGroup = dev.syncGroupId === 'standalone' ? 'default' : 'standalone';
    const ok = await setDeviceSyncGroup(dev.deviceId, nextGroup);
    if (ok) {
      showNotification(
        `« ${dev.customName || dev.name} » basculé en ${nextGroup === 'standalone' ? 'Mode Solo' : 'Mode Synchronisé'}.`
      );
      loadDevices();
    }
  };

  // Télécommande distante
  const handleRemotePlayPause = async (dev: UserConnectedDevice) => {
    if (!dev.currentPlayback) return;
    const nextPlay = !dev.currentPlayback.isPlaying;
    await sendDeviceCommand(dev.deviceId, nextPlay ? 'PLAY' : 'PAUSE');
    loadDevices();
  };

  const handleRemoteSeek = async (dev: UserConnectedDevice, offset: number) => {
    if (!dev.currentPlayback) return;
    const target = Math.max(0, (dev.currentPlayback.positionSeconds || 0) + offset);
    await sendDeviceCommand(dev.deviceId, 'SEEK', { positionSeconds: target });
    loadDevices();
  };

  const handleRemoteStop = async (dev: UserConnectedDevice) => {
    await sendDeviceCommand(dev.deviceId, 'STOP');
    showNotification(`Lecture arrêtée sur « ${dev.customName || dev.name} »`);
    loadDevices();
  };

  const handleSyncMyPlaybackToDevice = async (dev: UserConnectedDevice) => {
    if (!dev.currentPlayback) return;
    // Adopter la même lecture et le même groupe
    setLocalSyncGroupId(dev.syncGroupId || 'default');
    setLocalSyncGroupState(dev.syncGroupId || 'default');

    playerStore.openMedia({
      id: dev.currentPlayback.mediaId,
      title: dev.currentPlayback.mediaTitle,
      posterUrl: dev.currentPlayback.posterUrl,
      streamUrl: dev.currentPlayback.streamUrl || '',
      isLive: dev.currentPlayback.isLive,
      activeAudio: dev.currentPlayback.activeAudio,
      activeSubtitle: dev.currentPlayback.activeSubtitle,
      initialTime: dev.currentPlayback.positionSeconds,
      isRemoteSync: true,
    });
    showNotification(`Synchronisé avec « ${dev.customName || dev.name} »`);

    // Rediriger vers la page du lecteur pour un visionnage en plein écran immédiat
    router.push({
      pathname: `/player/${dev.currentPlayback.mediaId}`,
      params: {
        joinTime: String(Math.floor(dev.currentPlayback.positionSeconds || 0)),
        title: dev.currentPlayback.mediaTitle,
      },
    } as any);
  };

  // Diffusion de média vers un appareil
  const handleCastMediaToDevice = async (dev: UserConnectedDevice) => {
    const activeMedia = playerStore.getState().activeMedia;
    if (activeMedia) {
      await sendDeviceCommand(dev.deviceId, 'LOAD_MEDIA', {
        mediaId: activeMedia.id,
        title: activeMedia.title,
        streamUrl: activeMedia.streamUrl,
        posterUrl: activeMedia.posterUrl,
        positionSeconds: activeMedia.positionSeconds,
        syncGroupId: localSyncGroup,
      });
      showNotification(`« ${activeMedia.title} » diffusé sur « ${dev.customName || dev.name} »`);
    } else {
      setSelectedTargetIds([dev.deviceId]);
      setShowBroadcastModal(true);
    }
  };

  const handleSearchBroadcast = async (txt: string) => {
    setBroadcastQuery(txt);
    if (!txt.trim() || txt.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchMedia(txt);
      setSearchResults(res || []);
    } catch {} finally {
      setSearching(false);
    }
  };

  const handleStartBroadcast = async (media: any) => {
    if (selectedTargetIds.length === 0) {
      alert('Veuillez sélectionner au moins un appareil cible.');
      return;
    }
    await broadcastMediaToDevices(
      selectedTargetIds,
      {
        mediaId: media.id,
        title: media.title,
        posterUrl: media.posterUrl || media.fanartUrl,
        positionSeconds: 0,
      },
      'default'
    );
    setShowBroadcastModal(false);
    showNotification(`Diffusion lancée sur ${selectedTargetIds.length} appareil(s) !`);
    loadDevices();
  };

  const otherDevices = devices.filter((d) => d.deviceId !== currentDeviceId);
  const activeMedia = playerStore.getState().activeMedia;

  return (
    <View style={styles.container}>
      {/* Bannière de notification réactive */}
      {actionNotice && (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>✨ {actionNotice}</Text>
        </View>
      )}

      {/* En-tête de section */}
      <View style={styles.headerBox}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>📱 Appareils & Diffusions Connectés</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeTxt}>{devices.length} actif(s)</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Gérez vos écrans connectés, contrôlez les lectures à distance, synchronisez en multi-room ou
            déconnectez des appareils suspects.
          </Text>
        </View>

        {otherDevices.length > 0 && (
          <Pressable focusable={true} style={styles.dangerAllBtn} onPress={handleDisconnectAllOthers}>
            <Text style={styles.dangerAllBtnTxt}>🛡️ Déconnecter tous les autres</Text>
          </Pressable>
        )}
      </View>

      {/* Barre de contrôle locale de synchronisation de cet appareil */}
      <View style={styles.localControlCard}>
        <View style={styles.localControlLeft}>
          <Text style={styles.localControlIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.localDeviceName}>Cet écran : {devices.find((d) => d.isCurrentDevice)?.name || 'Cet Appareil'}</Text>
              <Text style={styles.currentBadge}>Actif ici</Text>
            </View>
            <Text style={styles.localDeviceDesc}>
              {localSyncGroup === 'standalone'
                ? '⚡ Mode Solo (Indépendant) : Vous pouvez regarder ce que vous voulez sans interférer avec les autres écrans.'
                : '🔗 Mode Synchronisé : Vos lectures et positions sont synchronisées avec les autres appareils du compte.'}
            </Text>
          </View>
        </View>

        <View style={styles.localActions}>
          <Pressable
            focusable={true}
            style={[styles.syncToggleBtn, localSyncGroup === 'standalone' ? styles.soloBtnActive : styles.syncBtnActive]}
            onPress={handleToggleLocalSolo}
          >
            <Text style={styles.syncToggleBtnTxt}>
              {localSyncGroup === 'standalone' ? '⚡ Passer en Mode Synchro' : '🔗 Passer en Mode Solo'}
            </Text>
          </Pressable>

          {activeMedia && otherDevices.length > 0 && (
            <Pressable
              focusable={true}
              style={styles.broadcastQuickBtn}
              onPress={() => {
                setSelectedTargetIds(otherDevices.map((d) => d.deviceId));
                setShowBroadcastModal(true);
              }}
            >
              <Text style={styles.broadcastQuickBtnTxt}>📡 Diffuser sur d'autres écrans</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Liste des appareils connectés */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#6366f1" size="large" />
          <Text style={styles.loadingTxt}>Détection des appareils connectés...</Text>
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTxt}>Aucun appareil détecté.</Text>
        </View>
      ) : (
        <View style={styles.devicesGrid}>
          {devices.map((dev) => {
            const isMe = dev.isCurrentDevice;
            const hasPlayback = Boolean(dev.currentPlayback && dev.currentPlayback.mediaId);
            const playback = dev.currentPlayback;

            return (
              <View
                key={dev.deviceId}
                style={[styles.deviceCard, isMe && styles.deviceCardCurrent, !dev.isOnline && styles.deviceCardOffline]}
              >
                {/* Ligne d'en-tête de la carte */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.deviceTypeIcon}>{getDeviceIcon(dev.deviceType)}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={styles.devNameRow}>
                        <Text style={styles.devNameText}>{dev.customName || dev.name}</Text>
                        <Pressable focusable={true} style={styles.editBtn} onPress={() => handleRename(dev)}>
                          <Text style={styles.editBtnTxt}>✏️</Text>
                        </Pressable>
                      </View>
                      <View style={styles.devMetaRow}>
                        <View style={[styles.statusDot, dev.isOnline ? styles.dotOnline : styles.dotOffline]} />
                        <Text style={styles.statusTxt}>
                          {dev.isOnline ? 'En ligne' : 'Inactif récemment'}
                        </Text>
                        {isMe && <Text style={styles.badgeMe}>Cet appareil</Text>}
                        <Text style={styles.badgeMode}>
                          {dev.syncGroupId === 'standalone' ? '⚡ Solo' : '🔗 Synchro'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {!isMe && (
                    <Pressable
                      focusable={true}
                      style={styles.disconnectBtn}
                      onPress={() => handleDisconnect(dev)}
                    >
                      <Text style={styles.disconnectBtnTxt}>🚪 Déconnecter</Text>
                    </Pressable>
                  )}
                </View>

                {/* Localisation et détails techniques */}
                <View style={styles.locationBox}>
                  <Text style={styles.locationTxt}>
                    📍 {dev.currentRoute ? `Sur ${dev.currentRoute}` : 'Connecté'}
                    {dev.clientInfo ? ` • ${dev.clientInfo}` : ''}
                  </Text>
                </View>

                {/* Bloc de lecture en cours et télécommande active */}
                {hasPlayback && playback && (
                  <View style={styles.playbackBox}>
                    <View style={styles.playbackHeader}>
                      <Text style={styles.playbackTag}>
                        {playback.isPlaying ? '▶️ EN COURS DE LECTURE' : '⏸️ EN PAUSE'}
                      </Text>
                      <Text style={styles.playbackTime}>
                        {formatTime(playback.positionSeconds)} / {formatTime(playback.durationSeconds)}
                      </Text>
                    </View>

                    <Text style={styles.playbackMediaTitle} numberOfLines={1}>
                      🎬 {playback.mediaTitle}
                    </Text>

                    {/* Barre de progression visuelle */}
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                playback.durationSeconds > 0
                                  ? (playback.positionSeconds / playback.durationSeconds) * 100
                                  : 0
                              )
                            )}%`,
                          },
                        ]}
                      />
                    </View>

                    {/* Contrôles de télécommande universelle */}
                    <View style={styles.remoteControlsRow}>
                      <Pressable
                        focusable={true}
                        style={styles.remoteBtn}
                        onPress={() => handleRemoteSeek(dev, -10)}
                      >
                        <Text style={styles.remoteBtnTxt}>⏪ -10s</Text>
                      </Pressable>

                      <Pressable
                        focusable={true}
                        style={[styles.remoteBtn, styles.remoteBtnPlay]}
                        onPress={() => handleRemotePlayPause(dev)}
                      >
                        <Text style={styles.remoteBtnTxt}>
                          {playback.isPlaying ? '⏸ Pause' : '▶ Play'}
                        </Text>
                      </Pressable>

                      <Pressable
                        focusable={true}
                        style={styles.remoteBtn}
                        onPress={() => handleRemoteSeek(dev, 30)}
                      >
                        <Text style={styles.remoteBtnTxt}>+30s ⏩</Text>
                      </Pressable>

                      <Pressable
                        focusable={true}
                        style={[styles.remoteBtn, styles.remoteBtnStop]}
                        onPress={() => handleRemoteStop(dev)}
                      >
                        <Text style={styles.remoteBtnTxt}>⏹ Stop</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Ligne d'actions sur l'appareil */}
                <View style={styles.cardActionsRow}>
                  {!isMe && (
                    <>
                      {/* Diffuser un média ici */}
                      <Pressable
                        focusable={true}
                        style={styles.actionBtnPrimary}
                        onPress={() => handleCastMediaToDevice(dev)}
                      >
                        <Text style={styles.actionBtnPrimaryTxt}>▶️ Diffuser un média ici</Text>
                      </Pressable>

                      {/* Synchroniser ma lecture avec cet appareil */}
                      {hasPlayback && (
                        <Pressable
                          focusable={true}
                          style={styles.actionBtnSecondary}
                          onPress={() => handleSyncMyPlaybackToDevice(dev)}
                        >
                          <Text style={styles.actionBtnSecondaryTxt}>🔗 Regarder en miroir</Text>
                        </Pressable>
                      )}

                      {/* Bascule du mode de synchro de cet appareil */}
                      <Pressable
                        focusable={true}
                        style={styles.actionBtnOutline}
                        onPress={() => handleToggleDeviceSyncMode(dev)}
                      >
                        <Text style={styles.actionBtnOutlineTxt}>
                          {dev.syncGroupId === 'standalone' ? '🔗 Lier en synchro' : '⚡ Rendre solo'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Modale de diffusion groupée / Multi-Room */}
      {showBroadcastModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📡 Diffusion Multi-Écrans (Multi-Room)</Text>
              <Pressable
                focusable={true}
                style={styles.modalCloseBtn}
                onPress={() => setShowBroadcastModal(false)}
              >
                <Text style={styles.modalCloseTxt}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              Sélectionnez les appareils sur lesquels diffuser simultanément en parfaite synchronisation :
            </Text>

            {/* Sélecteur d'appareils */}
            <View style={styles.targetList}>
              {devices.map((d) => {
                const isSelected = selectedTargetIds.includes(d.deviceId);
                return (
                  <Pressable
                    key={d.deviceId}
                    focusable={true}
                    style={[styles.targetItem, isSelected && styles.targetItemSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedTargetIds((prev) => prev.filter((id) => id !== d.deviceId));
                      } else {
                        setSelectedTargetIds((prev) => [...prev, d.deviceId]);
                      }
                    }}
                  >
                    <Text style={styles.targetIcon}>{getDeviceIcon(d.deviceType)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.targetName}>{d.customName || d.name}</Text>
                      <Text style={styles.targetRoute}>
                        {d.isCurrentDevice ? 'Cet écran' : d.currentRoute || 'En attente'}
                      </Text>
                    </View>
                    <Text style={[styles.checkboxTxt, isSelected && styles.checkboxTxtSelected]}>
                      {isSelected ? '☑️' : '⬜'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Choix du média : soit le média en cours, soit recherche */}
            {activeMedia && (
              <Pressable
                focusable={true}
                style={styles.broadcastActiveMediaBtn}
                onPress={() => handleStartBroadcast(activeMedia)}
              >
                <Text style={styles.broadcastActiveMediaTxt}>
                  ▶️ Diffuser le média en cours : « {activeMedia.title} »
                </Text>
              </Pressable>
            )}

            <Text style={styles.searchPrompt}>Ou rechercher un autre titre à diffuser :</Text>
            {Platform.OS === 'web' && (
              <input
                type="text"
                value={broadcastQuery}
                placeholder="Rechercher un film, une série ou une chaîne TV..."
                onChange={(e) => handleSearchBroadcast(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  fontSize: 14,
                  marginBottom: 12,
                  outline: 'none',
                }}
              />
            )}

            {searching && <ActivityIndicator color="#6366f1" style={{ marginVertical: 12 }} />}

            <ScrollView style={{ maxHeight: 180 }}>
              {searchResults.map((item) => (
                <Pressable
                  key={item.id}
                  focusable={true}
                  style={styles.searchResultItem}
                  onPress={() => handleStartBroadcast(item)}
                >
                  <Text style={styles.searchResultTitle} numberOfLines={1}>
                    🎬 {item.title} ({item.releaseYear || item.nodeType})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.six,
  },
  noticeBanner: {
    backgroundColor: '#3b82f6',
    padding: Spacing.three,
    borderRadius: Radius.md,
    marginBottom: Spacing.three,
  },
  noticeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  headerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  countBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  countBadgeTxt: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  dangerAllBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  dangerAllBtnTxt: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  localControlCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  localControlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 260,
  },
  localControlIcon: {
    fontSize: 28,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  localDeviceName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  currentBadge: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    textTransform: 'uppercase',
  },
  localDeviceDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  localActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  syncToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  syncBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  soloBtnActive: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderColor: '#eab308',
  },
  syncToggleBtnTxt: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  broadcastQuickBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  broadcastQuickBtnTxt: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingBox: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: 12,
  },
  loadingTxt: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyBox: {
    padding: Spacing.five,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: Radius.lg,
  },
  emptyTxt: {
    color: '#94a3b8',
    fontSize: 14,
  },
  devicesGrid: {
    gap: 16,
  },
  deviceCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  deviceCardCurrent: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  deviceCardOffline: {
    opacity: 0.75,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceTypeIcon: {
    fontSize: 32,
  },
  devNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  devNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  editBtn: {
    padding: 2,
  },
  editBtnTxt: {
    fontSize: 12,
  },
  devMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#94a3b8',
  },
  statusTxt: {
    fontSize: 12,
    color: '#94a3b8',
  },
  badgeMe: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeMode: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  disconnectBtnTxt: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  locationBox: {
    marginBottom: Spacing.three,
  },
  locationTxt: {
    fontSize: 12,
    color: '#64748b',
  },
  playbackBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  playbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  playbackTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818cf8',
  },
  playbackTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  playbackMediaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  remoteControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  remoteBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  remoteBtnPlay: {
    backgroundColor: '#4f46e5',
  },
  remoteBtnStop: {
    backgroundColor: '#dc2626',
  },
  remoteBtnTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtnPrimary: {
    backgroundColor: '#4338ca',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  actionBtnPrimaryTxt: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  actionBtnSecondaryTxt: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  actionBtnOutlineTxt: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: Spacing.four,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseTxt: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  modalDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: Spacing.three,
    lineHeight: 18,
  },
  targetList: {
    gap: 8,
    marginBottom: Spacing.three,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  targetItemSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  targetIcon: {
    fontSize: 20,
  },
  targetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  targetRoute: {
    fontSize: 11,
    color: '#64748b',
  },
  checkboxTxt: {
    fontSize: 16,
  },
  checkboxTxtSelected: {
    color: '#6366f1',
  },
  broadcastActiveMediaBtn: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  broadcastActiveMediaTxt: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  searchPrompt: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  searchResultItem: {
    padding: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  searchResultTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
});
