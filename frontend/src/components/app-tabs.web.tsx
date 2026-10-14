import {
  Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { MaxContentWidth, Spacing, Radius } from '@/constants/theme';

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList isMobile={isMobile}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton isMobile={isMobile}>🎬 Accueil</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton isMobile={isMobile}>🔍 Explorer</TabButton>
          </TabTrigger>
          <TabTrigger name="live" href={'/live' as any} asChild>
            <TabButton isMobile={isMobile}>📡 {isMobile ? 'Direct' : 'Direct TV'}</TabButton>
          </TabTrigger>
          <TabTrigger name="admin" href={'/admin' as any} asChild>
            <TabButton isMobile={isMobile}>⚙️ Admin</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children, isFocused, isMobile, ...props
}: TabTriggerSlotProps & { isMobile?: boolean }) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.tabButtonView, isMobile && styles.tabMobile, isFocused && styles.tabActive]}>
        <ThemedText type="small" style={[styles.tabText, isMobile && styles.textMobile, isFocused && styles.textActive]}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList({ isMobile, children, ...props }: TabListProps & { isMobile?: boolean }) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, isMobile && styles.innerMobile]}>
        <ThemedText type="smallBold" style={styles.brandText}>
          🍿 {isMobile ? 'UMS' : 'Universal Media Stack'}
        </ThemedText>
        {children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: { position: 'absolute', top: 0, width: '100%', padding: Spacing.two, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', zIndex: 999 },
  innerContainer: { paddingVertical: Spacing.one + 2, paddingHorizontal: Spacing.four, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', flexGrow: 1, gap: Spacing.two, maxWidth: MaxContentWidth, backgroundColor: 'rgba(15, 23, 42, 0.85)', borderWidth: 1, borderColor: 'rgba(51, 65, 85, 0.5)' },
  innerMobile: { paddingHorizontal: Spacing.two, gap: Spacing.one },
  brandText: { marginRight: 'auto', color: '#818cf8', fontWeight: '800', fontSize: 13 },
  pressed: { opacity: 0.7 },
  tabButtonView: { paddingVertical: Spacing.half + 2, paddingHorizontal: Spacing.three, borderRadius: Radius.pill },
  tabMobile: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  tabActive: { backgroundColor: 'rgba(99, 102, 241, 0.25)' },
  tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  textMobile: { fontSize: 11 },
  textActive: { color: '#f8fafc', fontWeight: '700' },
});
