import { Stack, DarkTheme, DefaultTheme, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform } from 'react-native';
import { useEffect } from 'react';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { FloatingBottomPlayer } from '@/components/FloatingBottomPlayer';
import { useActiveCastTarget } from '@/services/castState';
import {
  initGoogleCastFramework,
  registerAsReceiver,
  sendCastHeartbeat,
  pollDeviceCommands,
  getLocalDeviceId,
  getLocalDeviceName,
} from '@/services/castService';
import { startDeviceHeartbeatLoop } from '@/services/userDeviceService';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { syncSessionWithServer } from '@/services/authStore';
import { registerPwa } from '@/services/pwaRegistration';
import { OfflineIndicator } from '@/components/OfflineIndicator';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} else if (typeof document !== 'undefined') {
  initGoogleCastFramework();
  if (!document.getElementById('google-cast-sender-script')) {
    const script = document.createElement('script');
    script.id = 'google-cast-sender-script';
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    document.head.appendChild(script);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  useActiveCastTarget();
  useTvNavigation();

  useEffect(() => {
    registerPwa();
    syncSessionWithServer().catch(() => {});
  }, []);

  // Enregistrement actif de l'appareil local, battement de cœur et écouteur de télécommande universelle
  useEffect(() => {
    registerAsReceiver(getLocalDeviceName(), { isPlaying: false }).catch(() => {});
    startDeviceHeartbeatLoop(router);

    const interval = setInterval(() => {
      // Économiser le réseau et la batterie si l'onglet est en arrière-plan
      if (typeof document !== 'undefined' && document.hidden) return;

      sendCastHeartbeat({}).catch(() => {});

      // Si nous ne sommes pas sur la page lecteur (qui gère ses propres commandes en direct)
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/player')) {
        pollDeviceCommands(getLocalDeviceId(), (cmd) => {
          if (cmd.action === 'LOAD' && cmd.payload?.mediaId) {
            const params: any = {};
            if (cmd.payload.title) params.title = cmd.payload.title;
            if (cmd.payload.positionSeconds !== undefined && cmd.payload.positionSeconds > 0) {
              params.joinTime = String(Math.floor(cmd.payload.positionSeconds));
            }
            router.push({
              pathname: `/player/${cmd.payload.mediaId}`,
              params,
            } as any);
          }
        }).catch(() => {});
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [router]);

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
      <OfflineIndicator />
      <FloatingBottomPlayer />
    </ThemeProvider>
  );
}
