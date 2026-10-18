import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  mediaTitle: string;
  activeCastTarget?: { name: string } | null;
  activeAudioLabel?: string;
  activeSubtitleLabel?: string;
  isVoiceMuted?: boolean;
  viewersCount?: number;
  isLiveSpeaking?: boolean;
  onToggleVoiceMute?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onOpenRepost: () => void;
  onOpenShare: () => void;
  onOpenCast: () => void;
  onOpenAudio: () => void;
  onOpenSubtitles: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}

export function PlayerMenuModal({
  visible,
  mediaTitle,
  activeCastTarget,
  activeAudioLabel,
  activeSubtitleLabel,
  isVoiceMuted,
  viewersCount = 1,
  isLiveSpeaking = false,
  onToggleVoiceMute,
  isMuted = true,
  onToggleMute,
  onOpenRepost,
  onOpenShare,
  onOpenCast,
  onOpenAudio,
  onOpenSubtitles,
  onToggleFullscreen,
  onClose,
}: Props) {
  const firstBtnRef = useRef<any>(null);
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width < 480 || height < 600;
  const isLandscape = width > height && height < 550;

  const effectiveVoiceMuted = isVoiceMuted !== undefined ? isVoiceMuted : isMuted;
  const toggleVoice = onToggleVoiceMute || onToggleMute;

  useEffect(() => {
    if (visible) {
      setTimeout(() => firstBtnRef.current?.focus?.(), 60);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          {...({ dataSet: { modalBackdrop: 'true' } } as any)}
        />
        <View
          style={[
            styles.content,
            {
              width: isSmallScreen ? '94%' : '100%',
              maxWidth: Math.min(480, width - 24),
              maxHeight: isLandscape ? '94%' : '88%',
              padding: isSmallScreen ? 14 : Spacing.four,
            },
          ]}
          {...({ dataSet: { modalContainer: 'true' } } as any)}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.title}>⚙️ Options & Menu</Text>
              <Text numberOfLines={1} style={styles.subtitle}>{mediaTitle}</Text>
            </View>
            <Pressable
              focusable={true}
              onPress={onClose}
              style={styles.closeBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={[
              styles.list,
              {
                maxHeight: isLandscape ? Math.max(140, height - 90) : Math.min(480, height - 150),
              },
            ]}
            contentContainerStyle={[
              styles.listContent,
              { gap: isSmallScreen ? 6 : 8 },
            ]}
            showsVerticalScrollIndicator={true}
          >
            {/* Pistes Audio */}
            <Pressable
              ref={firstBtnRef}
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenAudio(); }}
              style={({ focused }: any) => [
                styles.item,
                isSmallScreen && styles.itemCompact,
                focused && styles.itemFocused,
              ]}
            >
              <Text style={styles.itemIcon}>🔊</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Pistes Audio</Text>
                <Text numberOfLines={isSmallScreen ? 1 : 2} style={styles.itemDesc}>
                  Changer de langue ou de piste sonore du média
                </Text>
              </View>
              {activeAudioLabel ? (
                <Text style={styles.badgeActive} numberOfLines={1}>{activeAudioLabel}</Text>
              ) : null}
            </Pressable>

            {/* Sous-titres */}
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenSubtitles(); }}
              style={({ focused }: any) => [
                styles.item,
                isSmallScreen && styles.itemCompact,
                focused && styles.itemFocused,
              ]}
            >
              <Text style={styles.itemIcon}>💬</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Sous-titres</Text>
                <Text numberOfLines={isSmallScreen ? 1 : 2} style={styles.itemDesc}>
                  Activer ou changer la langue des sous-titres
                </Text>
              </View>
              {activeSubtitleLabel ? (
                <Text style={activeSubtitleLabel !== 'Désactivé' ? styles.badgeActive : styles.badgeInactive} numberOfLines={1}>
                  {activeSubtitleLabel}
                </Text>
              ) : null}
            </Pressable>

            {/* Cast */}
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenCast(); }}
              style={({ focused }: any) => [
                styles.item,
                isSmallScreen && styles.itemCompact,
                activeCastTarget && styles.itemActive,
                focused && styles.itemFocused,
              ]}
            >
              <Text style={styles.itemIcon}>📡</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>
                  {activeCastTarget ? `Cast : ${activeCastTarget.name}` : 'Diffuser (Cast)'}
                </Text>
                <Text numberOfLines={isSmallScreen ? 1 : 2} style={styles.itemDesc}>
                  Envoyer la vidéo sur Google Cast, AirPlay ou écran distant
                </Text>
              </View>
              {activeCastTarget ? <Text style={styles.badgeActive}>Connecté</Text> : null}
            </Pressable>

            {/* Salon vocal WebRTC */}
            {toggleVoice && (
              <Pressable
                focusable={true}
                accessibilityRole="button"
                onPress={() => { toggleVoice(); }}
                style={({ focused }: any) => [
                  styles.item,
                  isSmallScreen && styles.itemCompact,
                  !effectiveVoiceMuted && styles.itemActive,
                  focused && styles.itemFocused,
                ]}
              >
                <Text style={styles.itemIcon}>🎙️</Text>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemLabel}>
                    {effectiveVoiceMuted ? 'Salon vocal : Micro coupé' : 'Salon vocal : En direct'}
                  </Text>
                  <Text numberOfLines={isSmallScreen ? 1 : 2} style={styles.itemDesc}>
                    {effectiveVoiceMuted
                      ? `Micro silencieux (écoute seule) • ${viewersCount} spectateur(s)`
                      : `Votre micro transmet au salon • ${viewersCount} spectateur(s)`}
                  </Text>
                </View>
                <Text style={!effectiveVoiceMuted ? styles.badgeActive : styles.badgeInactive}>
                  {effectiveVoiceMuted ? 'Micro off' : isLiveSpeaking ? 'Parle 🗣️' : 'Micro on'}
                </Text>
              </Pressable>
            )}

            {/* Partager */}
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenShare(); }}
              style={({ focused }: any) => [
                styles.item,
                isSmallScreen && styles.itemCompact,
                focused && styles.itemFocused,
              ]}
            >
              <Text style={styles.itemIcon}>🔗</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Partager</Text>
                <Text numberOfLines={isSmallScreen ? 1 : 2} style={styles.itemDesc}>
                  Lien de visionnage direct ou invitation Watch Party
                </Text>
              </View>
            </Pressable>

            {/* Avis & Repost */}
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenRepost(); }}
              style={({ focused }: any) => [
                styles.item,
                isSmallScreen && styles.itemCompact,
                focused && styles.itemFocused,
              ]}
            >
              <Text style={styles.itemIcon}>✍️</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Avis & Repost</Text>
                <Text numberOfLines={isSmallScreen ? 1 : 2} style={styles.itemDesc}>
                  Partager une critique, noter et recommander ce contenu
                </Text>
              </View>
            </Pressable>

            {/* Plein écran */}
            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onToggleFullscreen(); }}
              style={({ focused }: any) => [
                styles.item,
                isSmallScreen && styles.itemCompact,
                focused && styles.itemFocused,
              ]}
            >
              <Text style={styles.itemIcon}>⛶</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Plein écran</Text>
                <Text numberOfLines={isSmallScreen ? 1 : 2} style={styles.itemDesc}>
                  Basculer en immersion grand écran
                </Text>
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#0a0a0a',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#262626',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 20px rgba(0, 0, 0, 0.8)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 24 }),
    overflow: 'hidden',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  close: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: '#141414',
    borderWidth: 1.5,
    borderColor: '#222222',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  itemCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  itemFocused: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
    transform: [{ scale: 1.01 }],
  },
  itemActive: {
    borderColor: '#4f46e5',
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
  },
  itemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  itemMeta: {
    flex: 1,
    marginRight: 8,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  itemDesc: {
    fontSize: 11,
    color: '#777777',
    marginTop: 1,
  },
  badgeActive: {
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeInactive: {
    backgroundColor: '#262626',
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
});
