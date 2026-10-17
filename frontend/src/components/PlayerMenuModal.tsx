import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  mediaTitle: string;
  activeCastTarget?: { name: string } | null;
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
          style={styles.content}
          {...({ dataSet: { modalContainer: 'true' } } as any)}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.title}>⚙️ Options & Lecture</Text>
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
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
          >
            {onToggleMute && (
              <Pressable
                ref={firstBtnRef}
                focusable={true}
                accessibilityRole="button"
                onPress={() => { onToggleMute(); onClose(); }}
                style={({ focused }: any) => [
                  styles.item,
                  !isMuted && styles.itemActive,
                  focused && styles.itemFocused,
                ]}
              >
                <Text style={styles.itemIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemLabel}>
                    {isMuted ? 'Micro coupé (Mode Silence)' : 'Micro actif (Discussion en direct)'}
                  </Text>
                  <Text style={styles.itemDesc}>
                    {isMuted
                      ? 'Cliquez pour ouvrir votre micro aux autres spectateurs'
                      : 'Votre micro transmet votre voix au salon en temps réel'}
                  </Text>
                </View>
                <Text style={!isMuted ? styles.badgeActive : styles.badgeInactive}>
                  {isMuted ? 'Silence' : 'Actif'}
                </Text>
              </Pressable>
            )}

            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenRepost(); }}
              style={({ focused }: any) => [styles.item, focused && styles.itemFocused]}
            >
              <Text style={styles.itemIcon}>✍️</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Avis & Repost</Text>
                <Text style={styles.itemDesc}>Partager une critique, noter et recommander ce contenu</Text>
              </View>
            </Pressable>

            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenShare(); }}
              style={({ focused }: any) => [styles.item, focused && styles.itemFocused]}
            >
              <Text style={styles.itemIcon}>🔗</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Partager</Text>
                <Text style={styles.itemDesc}>Lien de visionnage direct ou invitation Watch Party</Text>
              </View>
            </Pressable>

            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenCast(); }}
              style={({ focused }: any) => [
                styles.item,
                activeCastTarget && styles.itemActive,
                focused && styles.itemFocused,
              ]}
            >
              <Text style={styles.itemIcon}>📡</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>
                  {activeCastTarget ? `Cast actif : ${activeCastTarget.name}` : 'Diffuser (Cast)'}
                </Text>
                <Text style={styles.itemDesc}>Envoyer la vidéo sur Google Cast, AirPlay ou écran distant</Text>
              </View>
              {activeCastTarget ? <Text style={styles.badgeActive}>Connecté</Text> : null}
            </Pressable>

            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenAudio(); }}
              style={({ focused }: any) => [styles.item, focused && styles.itemFocused]}
            >
              <Text style={styles.itemIcon}>🔊</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Pistes Audio</Text>
                <Text style={styles.itemDesc}>Sélectionner la langue audio (VF, VO, VOSTFR, multi)</Text>
              </View>
            </Pressable>

            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onOpenSubtitles(); }}
              style={({ focused }: any) => [styles.item, focused && styles.itemFocused]}
            >
              <Text style={styles.itemIcon}>💬</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Sous-titres (ST)</Text>
                <Text style={styles.itemDesc}>Activer ou désactiver les sous-titres intégrés</Text>
              </View>
            </Pressable>

            <Pressable
              focusable={true}
              accessibilityRole="button"
              onPress={() => { onClose(); onToggleFullscreen(); }}
              style={({ focused }: any) => [styles.item, focused && styles.itemFocused]}
            >
              <Text style={styles.itemIcon}>⛶</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>Plein Écran</Text>
                <Text style={styles.itemDesc}>Basculer en mode immersif plein écran</Text>
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
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
    zIndex: 99999,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' } : {}),
  },
  content: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0f172a',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    padding: Spacing.three,
    maxHeight: (Platform.OS === 'web' ? 'min(86vh, 540px)' : '85%') as any,
    alignSelf: 'center',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    ...(Platform.OS === 'web' ? { margin: 'auto' } : {}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  close: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 14,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    paddingBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: '#1e293b',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  itemActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  itemFocused: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  itemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  itemMeta: {
    flex: 1,
  },
  itemLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  badgeActive: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeInactive: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
});
