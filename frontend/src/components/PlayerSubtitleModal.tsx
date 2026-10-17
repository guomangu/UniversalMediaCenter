import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface SubtitleItem {
  index: number;
  label: string;
  language?: string;
  fileName?: string;
}

interface Props {
  visible: boolean;
  activeSubtitle: string;
  tracks: SubtitleItem[];
  onSelect: (subId: string) => void;
  onClose: () => void;
}

export function PlayerSubtitleModal({ visible, activeSubtitle, tracks = [], onSelect, onClose }: Props) {
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
            <Text style={styles.title}>💬 Sous-titres du média</Text>
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
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 8 }}>
                  {tracks.map((s, idx) => {
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
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
    zIndex: 99999,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' } : {}),
  },
  content: {
    backgroundColor: '#1e293b',
    borderRadius: Radius.lg,
    width: '100%',
    maxWidth: 380,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    zIndex: 2,
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { margin: 'auto' } : {}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  title: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { padding: 4, cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  close: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  list: { gap: 8 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(51, 65, 85, 0.4)', cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  activeItem: { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderWidth: 1, borderColor: '#6366f1' },
  itemText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', flex: 1 },
  activeText: { color: '#ffffff', fontWeight: '800' },
  check: { color: '#818cf8', fontSize: 14, fontWeight: '900', marginLeft: 8 },
  emptyWrap: { padding: 12, backgroundColor: 'rgba(51, 65, 85, 0.2)', borderRadius: Radius.md },
  emptyText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
});
