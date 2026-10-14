import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';
import { createRepost } from '@/services/repostApi';

interface Props {
  visible: boolean;
  mediaId: string;
  mediaTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MediaRepostModal({ visible, mediaId, mediaTitle, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const handlePost = async () => {
    setSubmitting(true);
    setMsg('');
    const res = await createRepost(mediaId, rating, comment);
    setSubmitting(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg('✨ Reposté avec succès !');
      setTimeout(() => {
        setMsg('');
        setComment('');
        onClose();
        onSuccess?.();
      }, 1000);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>🔄 Reposter & Noter</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.mediaName} numberOfLines={1}>
            {mediaTitle}
          </Text>

          {/* Note par étoiles */}
          <View style={styles.ratingRow}>
            <Text style={styles.label}>Votre note :</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)} style={styles.starBtn}>
                  <Text style={[styles.starTxt, rating >= star && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Commentaire optionnel */}
          <Text style={styles.label}>Votre avis ou commentaire (optionnel) :</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Ex: Une pépite absolue, animation et bande-son incroyables..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          {msg ? <Text style={styles.statusMsg}>{msg}</Text> : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </Pressable>
            <Pressable onPress={handlePost} disabled={submitting} style={styles.submitBtn}>
              <Text style={styles.submitTxt}>{submitting ? 'Publication...' : 'Publier mon avis'}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 4 },
  closeTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  mediaName: { fontSize: 14, color: '#818cf8', fontWeight: '600', marginBottom: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#cbd5e1', marginBottom: 6 },
  stars: { flexDirection: 'row', gap: 4 },
  starBtn: { padding: 4 },
  starTxt: { fontSize: 24, color: '#475569' },
  starActive: { color: '#fbbf24' },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  statusMsg: { color: '#34d399', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: '#334155' },
  cancelTxt: { color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  submitBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: '#6366f1' },
  submitTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
});
