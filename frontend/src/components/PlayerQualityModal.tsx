import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

export interface QualityItem {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  activeQuality: string;
  qualities?: QualityItem[];
  onSelect: (q: string) => void;
  onClose: () => void;
}

const DEFAULT_QUALITIES: QualityItem[] = [
  { label: 'Auto (Direct Play)', value: 'auto' },
  { label: '1080p FHD', value: '1080p' },
  { label: '720p HD', value: '720p' },
  { label: '480p SD', value: '480p' },
];

export function PlayerQualityModal({ visible, activeQuality, qualities = DEFAULT_QUALITIES, onSelect, onClose }: Props) {
  const list = qualities.length > 0 ? qualities : DEFAULT_QUALITIES;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>⚙️ Qualité Vidéo</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable>
          </View>
          <View style={styles.list}>
            {list.map((q) => {
              const isSelected = activeQuality === q.value;
              return (
                <Pressable
                  key={q.value}
                  onPress={() => { onSelect(q.value); onClose(); }}
                  style={[styles.item, isSelected && styles.activeItem]}>
                  <Text style={[styles.itemText, isSelected && styles.activeText]}>{q.label}</Text>
                  {isSelected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  content: { backgroundColor: '#1e293b', borderRadius: Radius.lg, width: '100%', maxWidth: 360, padding: Spacing.four, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  title: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  close: { color: '#94a3b8', fontSize: 16, fontWeight: '700', padding: 4 },
  list: { gap: 8 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(51, 65, 85, 0.4)', cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any },
  activeItem: { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderWidth: 1, borderColor: '#6366f1' },
  itemText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  activeText: { color: '#ffffff', fontWeight: '800' },
  check: { color: '#818cf8', fontSize: 16, fontWeight: '800' },
});
