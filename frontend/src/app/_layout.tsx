import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { CastControlBar } from '@/components/CastControlBar';
import { useActiveCastTarget, setActiveCastTarget } from '@/services/castState';
import { AuthGuard } from '@/components/auth/AuthGuard';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} else if (typeof document !== 'undefined' && !document.getElementById('google-cast-sender-script')) {
  const script = document.createElement('script');
  script.id = 'google-cast-sender-script';
  script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  script.async = true;
  document.head.appendChild(script);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const activeCastTarget = useActiveCastTarget();
  useTvNavigation();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="user" />
          <Stack.Screen name="tv" />
          <Stack.Screen name="media/[id]" />
          <Stack.Screen name="player/[id]" />
          <Stack.Screen name="forum/[topic]" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="live" />
        </Stack>
      </AuthGuard>
      {activeCastTarget && (
        <CastControlBar target={activeCastTarget} onDisconnect={() => setActiveCastTarget(null)} />
      )}
    </ThemeProvider>
  );
}
