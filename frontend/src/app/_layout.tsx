import { Stack, DarkTheme, DefaultTheme, ThemeProvider, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform } from 'react-native';
import { useEffect } from 'react';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { FloatingBottomPlayer } from '@/components/FloatingBottomPlayer';
import { useActiveCastTarget } from '@/services/castState';
import { playerStore } from '@/services/playerStore';
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
  const pathname = usePathname();
  useActiveCastTarget();
  useTvNavigation();

  // 1. Libération systématique du focus lors des changements de route pour éliminer tout piège WAI-ARIA
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const activeEl = document.activeElement;
      if (activeEl && activeEl !== document.body) {
        (activeEl as HTMLElement).blur?.();
      }
    }
  }, [pathname]);

  // 2. Sentinelle anti-focus-trap WAI-ARIA : empêche tout blocage 'Blocked aria-hidden on an element because its descendant retained focus'
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const releaseHiddenFocus = () => {
      const el = document.activeElement;
      if (!el || el === document.body) return;
      if (el.closest?.('[aria-hidden="true"]') || el.closest?.('[style*="display: none"]')) {
        (el as HTMLElement).blur?.();
        document.body.focus?.();
      }
    };

    window.addEventListener('focusin', releaseHiddenFocus, true);
    window.addEventListener('pointerdown', releaseHiddenFocus, true);

    const observer = new MutationObserver(() => {
      releaseHiddenFocus();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'style'],
      subtree: true,
    });

    return () => {
      window.removeEventListener('focusin', releaseHiddenFocus, true);
      window.removeEventListener('pointerdown', releaseHiddenFocus, true);
      observer.disconnect();
    };
  }, []);

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

      const pState = playerStore.getState();
      const active = pState.activeMedia;
      if (active) {
        sendCastHeartbeat({
          currentMediaId: active.id,
          mediaTitle: active.title,
          positionSeconds: active.positionSeconds || 0,
          durationSeconds: active.durationSeconds || 0,
          isPlaying: active.isPlaying,
          volume: pState.volume,
          isMuted: pState.isMuted,
        }).catch(() => {});
      } else {
        sendCastHeartbeat({}).catch(() => {});
      }

      // Gestion universelle des commandes distantes même quand le lecteur est replié ou lors de la navigation
      if (typeof window !== 'undefined') {
        pollDeviceCommands(getLocalDeviceId(), (cmd) => {
          if (cmd.action === 'LOAD' && cmd.payload?.mediaId) {
            playerStore.openMedia({
              id: cmd.payload.mediaId,
              title: cmd.payload.title || 'Média',
              streamUrl: cmd.payload.streamUrl || `/api/media/${cmd.payload.mediaId}/stream`,
              posterUrl: cmd.payload.posterUrl || `/api/media/${cmd.payload.mediaId}/poster`,
              isLive: Boolean(cmd.payload.isLive),
              initialTime: cmd.payload.positionSeconds || 0,
              expand: true,
            });
          } else if (cmd.action === 'PLAY') {
            playerStore.setPlaying(true, true, true);
          } else if (cmd.action === 'PAUSE') {
            playerStore.setPlaying(false, true, true);
          } else if (cmd.action === 'SEEK') {
            if (typeof cmd.payload?.positionSeconds === 'number') {
              playerStore.seekTo(cmd.payload.positionSeconds, true, true);
            }
          } else if (cmd.action === 'STOP') {
            playerStore.closeMedia();
          } else if (cmd.action === 'SET_VOLUME') {
            if (typeof cmd.payload?.volume === 'number') {
              playerStore.setVolume(cmd.payload.volume);
            }
          } else if (cmd.action === 'MUTE') {
            playerStore.setMuted(true);
          } else if (cmd.action === 'UNMUTE') {
            playerStore.setMuted(false);
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
