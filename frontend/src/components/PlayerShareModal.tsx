import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthHeaders } from '@/services/authStore';

interface Props {
  visible: boolean;
  mediaId: string;
  mediaTitle?: string;
  onClose: () => void;
}

export function PlayerShareModal({ visible, mediaId, mediaTitle, onClose }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    if (visible && mediaId) {
      fetch(`${getApiBaseUrl()}/api/media/${mediaId}/share-token`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.shareToken) {
            setShareToken(data.shareToken);
          }
        })
        .catch(() => {});
    }
  }, [visible, mediaId]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
  const queryParam = shareToken ? `?share=${shareToken}` : '';
  const shareUrl = `${origin}/player/${mediaId}${queryParam}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: mediaTitle || 'Regarder sur UMS', url: shareUrl });
        onClose();
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const handleGoToForum = () => {
    onClose();
    router.push({ pathname: '/forum/[topic]', params: { topic: mediaId, title: mediaTitle || 'Lecture' } } as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>🔗 Partager ce média</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable>
          </View>
          <View style={styles.list}>
            <Pressable onPress={handleNativeShare} style={styles.item}>
              <Text style={styles.itemIcon}>📲</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Partager avec mes contacts</Text>
                <Text style={styles.itemSub}>Lien direct sécurisé (WhatsApp, Telegram, etc.)</Text>
              </View>
            </Pressable>
            <Pressable onPress={handleCopyLink} style={styles.item}>
              <Text style={styles.itemIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{copied ? '✓ Lien copié !' : 'Copier le lien direct'}</Text>
                <Text numberOfLines={1} style={styles.itemSub}>{shareUrl}</Text>
              </View>
            </Pressable>
            <Pressable onPress={handleGoToForum} style={[styles.item, styles.forumItem]}>
              <Text style={styles.itemIcon}>💬</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: '#a5b4fc' }]}>Ouvrir le Forum WhatsApp du média</Text>
                <Text style={styles.itemSub}>Échanger avis, vocaux et captures d'écran</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  content: { backgroundColor: '#1e293b', borderRadius: Radius.lg, width: '100%', maxWidth: 400, padding: Spacing.four, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  title: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  close: { color: '#94a3b8', fontSize: 16, fontWeight: '700', padding: 4 },
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(51, 65, 85, 0.4)', cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  forumItem: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.4)' },
  itemIcon: { fontSize: 20 },
  itemTitle: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  itemSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
});
