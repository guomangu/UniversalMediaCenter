import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Image, Platform, Linking } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  mediaType: 'VIDEO' | 'IMAGE' | 'GIF' | 'DOCUMENT' | string;
  mediaUrl: string;
  fileName?: string | null;
}

export function ForumMediaModal({
  visible,
  onClose,
  mediaType,
  mediaUrl,
  fileName,
}: Props) {
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  const isVideo = mediaType === 'VIDEO';
  const isImage = mediaType === 'IMAGE' || mediaType === 'GIF';
  const isDoc = mediaType === 'DOCUMENT';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} focusable={false} data-modal-backdrop="true">
        <Pressable
          style={styles.container}
          onPress={(e) => e.stopPropagation()}
          data-modal-container="true"
        >
          {/* Header avec Titre et Bouton Fermer */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>
                {isVideo ? '🎬' : isImage ? '🖼️' : '📄'}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {fileName || (isVideo ? 'Vidéo du forum' : isImage ? 'Image' : 'Document')}
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn} data-modal-close="true">
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          {/* Corps du média agrandi */}
          <View style={styles.mediaBody}>
            {isVideo && Platform.OS === 'web' ? (
              // @ts-ignore - HTML5 video avec son déverrouillé et contrôles complets
              <video
                src={mediaUrl}
                controls
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '72vh',
                  borderRadius: Radius.md,
                  backgroundColor: '#000000',
                  outline: 'none',
                }}
              />
            ) : null}

            {isImage ? (
              <Image
                source={{ uri: mediaUrl }}
                style={styles.expandedImg}
                resizeMode="contain"
              />
            ) : null}

            {isDoc ? (
              <View style={styles.docBox}>
                <Text style={styles.docIcon}>📄</Text>
                <Text style={styles.docName} numberOfLines={2}>
                  {fileName || 'Document joint'}
                </Text>
                <Text style={styles.docUrl} numberOfLines={1}>
                  {mediaUrl}
                </Text>

                <View style={styles.docActions}>
                  <Pressable
                    style={styles.docBtn}
                    onPress={() => Linking.openURL(mediaUrl)}
                  >
                    <Text style={styles.docBtnTxt}>⬇️ Ouvrir / Télécharger</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          {/* Pied de popup avec actions directes */}
          <View style={styles.footer}>
            <Pressable
              style={styles.openExternalBtn}
              onPress={() => Linking.openURL(mediaUrl)}
            >
              <Text style={styles.openExternalTxt}>↗ Ouvrir dans un nouvel onglet</Text>
            </Pressable>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneTxt}>Fermer</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    zIndex: 9999,
  },
  container: {
    width: '100%',
    maxWidth: 860,
    maxHeight: '90%',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  headerIcon: {
    fontSize: 20,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeTxt: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mediaBody: {
    padding: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 240,
    maxHeight: '74%',
    backgroundColor: '#0a0f1d',
  },
  expandedImg: {
    width: '100%',
    height: 520,
    maxHeight: '100%',
    borderRadius: Radius.md,
  },
  docBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
    width: '100%',
  },
  docIcon: {
    fontSize: 54,
    marginBottom: 12,
  },
  docName: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  docUrl: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  docActions: {
    flexDirection: 'row',
    gap: 12,
  },
  docBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  docBtnTxt: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  openExternalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  openExternalTxt: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: '#4338ca',
  },
  doneTxt: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
