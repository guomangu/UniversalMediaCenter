import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { MaxContentWidth, Spacing, Radius } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>🎬 Accueil</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>🔍 Explorer</TabButton>
          </TabTrigger>
          <TabTrigger name="live" href={'/live' as any} asChild>
            <TabButton>📡 Direct TV</TabButton>
          </TabTrigger>
          <TabTrigger name="admin" href={'/admin' as any} asChild>
            <TabButton>⚙️ Admin</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.tabButtonView, isFocused && styles.tabButtonActive]}>
        <ThemedText type="small" style={[styles.tabText, isFocused && styles.tabTextActive]}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          🍿 Universal Media Stack
        </ThemedText>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute', top: 0, width: '100%', padding: Spacing.two,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row', zIndex: 999,
  },
  innerContainer: {
    paddingVertical: Spacing.one + 2, paddingHorizontal: Spacing.four, borderRadius: Radius.pill,
    flexDirection: 'row', alignItems: 'center', flexGrow: 1, gap: Spacing.two,
    maxWidth: MaxContentWidth, backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1, borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  brandText: { marginRight: 'auto', color: '#818cf8', fontWeight: '800' },
  pressed: { opacity: 0.7 },
  tabButtonView: { paddingVertical: Spacing.half + 2, paddingHorizontal: Spacing.three, borderRadius: Radius.pill },
  tabButtonActive: { backgroundColor: 'rgba(99, 102, 241, 0.25)' },
  tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#f8fafc', fontWeight: '700' },
});
