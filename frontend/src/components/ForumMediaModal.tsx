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
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          focusable={false}
          data-modal-backdrop="true"
        />
        <View
          style={styles.container}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
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
    zIndex: 1,
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
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  headerIcon: { fontSize: 20 },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  mediaBody: {
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  expandedImg: {
    width: '100%',
    height: 480,
    borderRadius: Radius.md,
  },
  docBox: {
    alignItems: 'center',
    padding: Spacing.five,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    width: '100%',
  },
  docIcon: { fontSize: 48, marginBottom: 12 },
  docName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 6,
  },
  docUrl: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  docActions: { flexDirection: 'row', gap: 10 },
  docBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  docBtnTxt: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  openExternalBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  openExternalTxt: { color: '#818cf8', fontSize: 13, fontWeight: '600' },
  doneBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  doneTxt: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
});
