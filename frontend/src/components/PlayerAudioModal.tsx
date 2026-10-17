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
              <Text style={[styles.itemText, activeAudio === 'auto' && styles.activeText]}>Piste par défaut</Text>
              {activeAudio === 'auto' ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>

            {tracks.length <= 1 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  {tracks[0] ? `Piste unique disponible : ${tracks[0].label}` : 'Une seule piste audio par défaut.'}
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  content: { backgroundColor: '#1e293b', borderRadius: Radius.lg, width: '100%', maxWidth: 380, padding: Spacing.four, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', zIndex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  title: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  close: { color: '#94a3b8', fontSize: 16, fontWeight: '700', padding: 4 },
  list: { gap: 8 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(51, 65, 85, 0.4)', cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  activeItem: { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderWidth: 1, borderColor: '#6366f1' },
  itemText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', flex: 1 },
  activeText: { color: '#ffffff', fontWeight: '800' },
  check: { color: '#818cf8', fontSize: 14, fontWeight: '900', marginLeft: 8 },
  emptyWrap: { padding: 12, backgroundColor: 'rgba(51, 65, 85, 0.2)', borderRadius: Radius.md },
  emptyText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
});
