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
  amber: { bg: 'rgba(217, 145, 30, 0.12)', text: '#cfb991', border: 'rgba(217, 145, 30, 0.25)' },
  rose: { bg: 'rgba(200, 80, 100, 0.12)', text: '#d994a0', border: 'rgba(200, 80, 100, 0.25)' },
  emerald: { bg: 'rgba(40, 140, 100, 0.12)', text: '#88c7a8', border: 'rgba(40, 140, 100, 0.25)' },
  indigo: { bg: 'rgba(80, 100, 130, 0.14)', text: '#aabccc', border: 'rgba(80, 100, 130, 0.25)' },
  violet: { bg: 'rgba(110, 95, 140, 0.14)', text: '#b8adc8', border: 'rgba(110, 95, 140, 0.25)' },
  slate: { bg: 'rgba(148, 163, 184, 0.12)', text: '#c2cbd7', border: 'rgba(148, 163, 184, 0.2)' },
  sky: { bg: 'rgba(60, 110, 145, 0.12)', text: '#9cbccd', border: 'rgba(60, 110, 145, 0.22)' },
  teal: { bg: 'rgba(45, 125, 120, 0.12)', text: '#92c2be', border: 'rgba(45, 125, 120, 0.22)' },
  orange: { bg: 'rgba(195, 110, 50, 0.12)', text: '#cc9e78', border: 'rgba(195, 110, 50, 0.22)' },
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
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  text: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  subtext: {
    color: '#8a95a5',
    fontSize: 10.5,
    fontWeight: '500',
  },
});
