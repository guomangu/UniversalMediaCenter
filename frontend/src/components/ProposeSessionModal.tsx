import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { createSession, MediaSession } from '@/services/sessionApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  nodeId: string;
  defaultTitle: string;
  topicSlug: string;
  onClose: () => void;
  onCreated: (session: MediaSession) => void;
}

export function ProposeSessionModal({
  visible,
  nodeId,
  defaultTitle,
  topicSlug,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState(defaultTitle ? `Séance Ciné : ${defaultTitle}` : 'Séance Ciné');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!nodeId || !title.trim()) return;
    setSubmitting(true);
    const session = await createSession({
      nodeId,
      topicSlug,
      title: title.trim(),
    });
    setSubmitting(false);
    if (session) {
      onCreated(session);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} focusable={false} data-modal-backdrop="true">
        <Pressable
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
          data-modal-container="true"
        >
          <View style={styles.header}>
            <Text style={styles.title}>🍿 Proposer une Séance de Groupe</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} data-modal-close="true">
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.desc}>
            En créant cette séance, vous devenez le gérant de la projection. Les autres spectateurs pourront s'inscrire, discuter en vocal et synchroniser leur visionnage !
          </Text>

          <Text style={styles.label}>Intitulé de la séance :</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Séance Popcorn Bleach avec le groupe"
            placeholderTextColor="#64748b"
          />

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </Pressable>
            <Pressable onPress={handleSubmit} disabled={submitting} style={styles.submitBtn}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitTxt}>Lancer la séance</Text>
              )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 6 },
  closeTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  desc: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  label: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: Radius.md,
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(51, 65, 85, 0.7)',
  },
  cancelTxt: { color: '#cbd5e1', fontWeight: '700', fontSize: 13 },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: '#6366f1',
  },
  submitTxt: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
});
