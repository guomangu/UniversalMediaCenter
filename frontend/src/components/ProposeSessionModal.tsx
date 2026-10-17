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
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          focusable={false}
          data-modal-backdrop="true"
        />
        <View
          style={styles.modalContent}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
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
    zIndex: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 6 },
  closeTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  desc: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  label: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: Radius.md,
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  cancelTxt: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  submitTxt: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
