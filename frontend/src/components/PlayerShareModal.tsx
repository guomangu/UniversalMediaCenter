import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';

interface PlayerShareModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle: string;
}

export function PlayerShareModal({
  visible,
  onClose,
  mediaId,
  mediaTitle,
}: PlayerShareModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const firstBtnRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => firstBtnRef.current?.focus?.(), 60);
    }
  }, [visible]);

  if (!visible) return null;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/player/${mediaId}`
    : `http://localhost:8081/player/${mediaId}`;

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: mediaTitle,
          text: `Regarde ${mediaTitle} sur Universal Media Stack !`,
          url: shareUrl,
        });
        onClose();
      } else {
        handleCopyLink();
      }
    } catch {
      // Annulé
    }
  };

  const handleOpenForum = () => {
    onClose();
    router.push({ pathname: '/forum/[topic]', params: { topic: mediaId, title: mediaTitle || 'Lecture' } } as any);
  };

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
            <Text style={styles.title}>🔗 Partager ce média</Text>
            <Pressable
              focusable={true}
              onPress={onClose}
              style={styles.closeBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            <Pressable
              ref={firstBtnRef}
              focusable={true}
              onPress={handleNativeShare}
              style={styles.item}
            >
              <Text style={styles.itemIcon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Partager avec mes contacts</Text>
                <Text style={styles.itemSub}>Lien direct sécurisé (WhatsApp, Telegram, etc.)</Text>
              </View>
            </Pressable>
            <Pressable focusable={true} onPress={handleCopyLink} style={styles.item}>
              <Text style={styles.itemIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>
                  {copied ? '✅ Lien copié dans le presse-papier !' : 'Copier le lien du média'}
                </Text>
                <Text style={styles.itemSub} numberOfLines={1}>{shareUrl}</Text>
              </View>
            </Pressable>
            <Pressable focusable={true} onPress={handleOpenForum} style={styles.item}>
              <Text style={styles.itemIcon}>💬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Discussion / Forum du média</Text>
                <Text style={styles.itemSub}>Échanger avec les autres membres en direct</Text>
              </View>
            </Pressable>
          </View>
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
    backgroundColor: '#1e293b',
    borderRadius: Radius.lg,
    width: '100%',
    maxWidth: 420,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    zIndex: 2,
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { margin: 'auto' } : {}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  title: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 4, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  close: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  list: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.md, backgroundColor: 'rgba(51, 65, 85, 0.4)', cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  itemIcon: { fontSize: 24 },
  itemTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  itemSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
});
