import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface TagPillProps {
  label: string;
  theme?: string;
  onPress?: () => void;
  subtext?: string;
}

const themeColors: Record<string, { bg: string; text: string; border: string }> = {
  amber: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)' },
  rose: { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.35)' },
  emerald: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.35)' },
  indigo: { bg: 'rgba(99, 102, 241, 0.15)', text: '#a5b4fc', border: 'rgba(99, 102, 241, 0.35)' },
  violet: { bg: 'rgba(139, 92, 246, 0.15)', text: '#c4b5fd', border: 'rgba(139, 92, 246, 0.35)' },
  slate: { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.25)' },
};

export const TagPill: React.FC<TagPillProps> = ({ label, theme = 'slate', onPress, subtext }) => {
  const activeColor = themeColors[theme] || themeColors.slate;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: activeColor.bg, borderColor: activeColor.border },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.text, { color: activeColor.text }]}>{label}</Text>
      {subtext ? <Text style={styles.subtext}> • {subtext}</Text> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.half + 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: Spacing.one + 2,
    marginBottom: Spacing.one + 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  subtext: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 2,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
