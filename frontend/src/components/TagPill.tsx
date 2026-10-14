import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const activeColor = themeColors[theme] || themeColors.slate;

  const handlePress = () => {
    if (onPress) return onPress();
    const slug = label.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    router.push({ pathname: '/forum/[topic]', params: { topic: slug, title: label } } as any);
  };

  return (
    <Pressable
      focusable={true}
      onPress={handlePress}
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
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  subtext: {
    color: '#94a3b8',
    fontSize: 11,
  },
});
