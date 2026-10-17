import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet } from 'react-native';
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
  const firstBtnRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        firstBtnRef.current?.focus?.();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [visible]);

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
      <View style={styles.overlay}>
        {/* Backdrop transparent/sombre en arrière-plan (clic extérieur pour fermer sans interférence avec l'input) */}
        <Pressable
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          {...({ dataSet: { modalBackdrop: 'true' } } as any)}
        />
        {/* Boîte de dialogue isolée au premier plan */}
        <View style={styles.modalCard} {...({ dataSet: { modalContainer: 'true' } } as any)}>
          <View style={styles.header}>
            <Text style={styles.title}>🔄 Reposter & Noter</Text>
            <Pressable
              focusable={true}
              onPress={onClose}
              style={styles.closeBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
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
              {[1, 2, 3, 4, 5].map((star, idx) => (
                <Pressable
                  ref={idx === 0 ? firstBtnRef : undefined}
                  key={star}
                  focusable={true}
                  onPress={() => setRating(star)}
                  style={styles.starBtn}
                >
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
            <Pressable
              focusable={true}
              onPress={onClose}
              style={styles.cancelBtn}
              {...({ dataSet: { modalClose: 'true' } } as any)}
            >
              <Text style={styles.cancelTxt}>Annuler</Text>
            </Pressable>
            <Pressable
              focusable={true}
              onPress={handlePost}
              disabled={submitting}
              style={styles.submitBtn}
            >
              <Text style={styles.submitTxt}>{submitting ? 'Publication...' : 'Publier mon avis'}</Text>
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
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  closeBtn: {
    padding: 6,
  },
  closeTxt: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  mediaName: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '700',
    marginBottom: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
  },
  starBtn: {
    padding: 6,
  },
  starTxt: {
    fontSize: 24,
    color: '#475569',
  },
  starActive: {
    color: '#fbbf24',
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: Radius.md,
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 14,
  },
  statusMsg: {
    color: '#34d399',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
  },
  cancelTxt: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Radius.pill,
  },
  submitTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
});
