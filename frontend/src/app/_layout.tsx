import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { CastControlBar } from '@/components/CastControlBar';
import { useActiveCastTarget, setActiveCastTarget } from '@/services/castState';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const activeCastTarget = useActiveCastTarget();
  useTvNavigation();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="media/[id]" />
        <Stack.Screen name="player/[id]" />
        <Stack.Screen name="forum/[topic]" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="live" />
      </Stack>
      {activeCastTarget && (
        <CastControlBar target={activeCastTarget} onDisconnect={() => setActiveCastTarget(null)} />
      )}
    </ThemeProvider>
  );
}
