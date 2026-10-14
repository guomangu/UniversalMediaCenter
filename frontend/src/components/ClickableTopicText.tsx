import React from 'react';
import { Text, Pressable, TextStyle, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  text: string;
  topicSlug?: string;
  topicTitle?: string;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}

export function ClickableTopicText({ text, topicSlug, topicTitle, style, numberOfLines }: Props) {
  const router = useRouter();

  const handlePress = () => {
    const slug = topicSlug || text.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const title = topicTitle || text;
    router.push({
      pathname: '/forum/[topic]',
      params: { topic: slug, title },
    } as any);
  };

  return (
    <Pressable
      focusable={true}
      onPress={handlePress}
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}>
      <Text style={[styles.defaultText, style]} numberOfLines={numberOfLines}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  defaultText: {
    color: '#f1f5f9',
  },
  pressed: {
    opacity: 0.7,
  },
});
