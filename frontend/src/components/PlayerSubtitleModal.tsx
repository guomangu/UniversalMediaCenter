import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export interface SubtitleTrackItem {
  index: number;
  language: string;
  label: string;
  fileName?: string;
}

interface Props {
  visible: boolean;
  activeSubtitle: string;
  tracks: SubtitleTrackItem[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function PlayerSubtitleModal({ visible, activeSubtitle, tracks = [], onSelect, onClose }: Props) {
  const activeBtnRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => activeBtnRef.current?.focus?.(), 60);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.content}
          onPress={(e) => e.stopPropagation()}
          {...({ dataSet: { modalContainer: 'true' } } as any)}
        >
          <View style={styles.header}>
            <Text style={styles.title}>💬 Sous-titres du média</Text>
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
              ref={activeSubtitle === 'off' ? activeBtnRef : undefined}
              focusable={true}
              onPress={() => { onSelect('off'); onClose(); }}
              style={[styles.item, activeSubtitle === 'off' && styles.activeItem]}
            >
              <Text style={[styles.itemText, activeSubtitle === 'off' && styles.activeText]}>Désactivé</Text>
              {activeSubtitle === 'off' ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>

            {tracks.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Aucun sous-titre compatible détecté pour ce fichier vidéo.</Text>
              </View>
            ) : (
              tracks.map((s, idx) => {
                const val = s.fileName ? `file:${s.fileName}` : `track:${s.index}`;
                const isSelected = activeSubtitle === val;
                return (
                  <Pressable
                    ref={isSelected ? activeBtnRef : undefined}
                    key={`${val}-${idx}`}
                    focusable={true}
                    onPress={() => { onSelect(val); onClose(); }}
                    style={[styles.item, isSelected && styles.activeItem]}
                  >
                    <Text style={[styles.itemText, isSelected && styles.activeText]}>{s.label}</Text>
                    {isSelected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  content: { backgroundColor: '#1e293b', borderRadius: Radius.lg, width: '100%', maxWidth: 380, padding: Spacing.four, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
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
