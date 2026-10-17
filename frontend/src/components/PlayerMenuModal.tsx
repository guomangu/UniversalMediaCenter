import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  mediaTitle: string;
  activeCastTarget?: { name: string } | null;
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

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            <Pressable
              ref={firstBtnRef}
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0f172a',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
  },
  close: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  itemFocused: {
    backgroundColor: '#312e81',
    borderColor: '#818cf8',
    transform: [{ scale: 1.02 }],
  },
  itemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  itemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  itemMeta: {
    flex: 1,
  },
  itemLabel: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  itemDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  badgeActive: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
});
