import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { rateUser, fetchUserRatings, UserRatingStats } from '@/services/ratingApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  targetUserId: string;
  targetUserName: string;
  onClose: () => void;
  onRated?: () => void;
}

export function UserRatingModal({
  visible,
  targetUserId,
  targetUserName,
  onClose,
  onRated,
}: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<UserRatingStats | null>(null);

  useEffect(() => {
    if (visible && targetUserId) {
      fetchUserRatings(targetUserId).then(setStats);
      setRating(5);
      setComment('');
    }
  }, [visible, targetUserId]);

  const handleSubmit = async () => {
    if (!targetUserId) return;
    setSubmitting(true);
    const ok = await rateUser(targetUserId, rating, comment);
    setSubmitting(false);
    if (ok) {
      onRated?.();
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
            <Text style={styles.title}>⭐ Évaluer {targetUserName}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} data-modal-close="true">
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          {stats ? (
            <View style={styles.statsRow}>
              <Text style={styles.statsAvg}>
                ★ {stats.average > 0 ? stats.average.toFixed(1) : '-'} / 5
              </Text>
              <Text style={styles.statsCount}>
                ({stats.total} avis reçu{stats.total > 1 ? 's' : ''})
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Votre note pour le gérant / membre :</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                focusable={true}
                onPress={() => setRating(star)}
                style={styles.starBtn}
              >
                <Text style={[styles.starTxt, star <= rating && styles.starActive]}>★</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Commentaire (optionnel) :</Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Ex: Super animateur de séance, film ponctuel et convivial !"
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
          />

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </Pressable>
            <Pressable onPress={handleSubmit} disabled={submitting} style={styles.submitBtn}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitTxt}>Valider la note</Text>
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
    maxWidth: 440,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 6 },
  closeTxt: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    padding: 8,
    borderRadius: Radius.md,
  },
  statsAvg: { color: '#fbbf24', fontSize: 16, fontWeight: '900' },
  statsCount: { color: '#94a3b8', fontSize: 12 },
  label: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginTop: 4 },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 4,
  },
  starBtn: { padding: 4, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  starTxt: { fontSize: 32, color: '#475569' },
  starActive: { color: '#fbbf24' },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: Radius.md,
    padding: 10,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
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
