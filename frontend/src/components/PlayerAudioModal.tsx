import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface TrackItem {
  index: number;
  label: string;
}

interface Props {
  visible: boolean;
  activeAudio: string;
  tracks: TrackItem[];
  onSelect: (audioId: string) => void;
  onClose: () => void;
}

export function PlayerAudioModal({ visible, activeAudio, tracks = [], onSelect, onClose }: Props) {
  const activeBtnRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => activeBtnRef.current?.focus?.(), 60);
    }
  }, [visible]);

  if (!visible) return null;

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
            <Text style={styles.title}>🔊 Pistes Audio du média</Text>
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
              ref={activeAudio === 'auto' ? activeBtnRef : undefined}
              focusable={true}
              onPress={() => { onSelect('auto'); onClose(); }}
              style={[styles.item, activeAudio === 'auto' && styles.activeItem]}
            >
              <Text style={[styles.itemText, activeAudio === 'auto' && styles.activeText]}>Piste automatique (Préférée)</Text>
              {activeAudio === 'auto' ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>

            {tracks.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  Une seule piste audio directe disponible ou flux live.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 8 }}>
                  {tracks.map((t) => {
                    const val = String(t.index);
                    const isSelected = activeAudio === val;
                    return (
                      <Pressable
                        ref={isSelected ? activeBtnRef : undefined}
                        key={val}
                        focusable={true}
                        onPress={() => { onSelect(val); onClose(); }}
                        style={[styles.item, isSelected && styles.activeItem]}
                      >
                        <Text style={[styles.itemText, isSelected && styles.activeText]}>{t.label}</Text>
                        {isSelected ? <Text style={styles.check}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#0a0a0a',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    width: '90%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#262626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
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
    borderBottomColor: '#1f1f1f',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  close: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: '#141414',
    borderWidth: 1.5,
    borderColor: '#222222',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  activeItem: {
    borderColor: '#4f46e5',
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
  },
  itemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cccccc',
    flex: 1,
    marginRight: 8,
  },
  activeText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  check: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '900',
  },
  emptyWrap: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: '#777777',
    fontSize: 12,
    textAlign: 'center',
  },
});
