import { useEffect } from 'react';
import { Platform } from 'react-native';
import { sendCastCommand } from '@/services/castService';
import { toggleFullscreen } from '@/utils/fullscreen';

interface UsePlayerControlsProps {
  videoRef: React.RefObject<any>;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  isModalOpen: boolean;
  activeCastTarget: any;
  showToast: (msg: string) => void;
  isFullscreen?: boolean;
  onUserAction?: () => void;
}

/**
 * Contrôleur média pour écran /player :
 * - Mode plein écran (isFullscreen = true) : flèches directionnelles gèrent la progression média
 * - Mode normal (isFullscreen = false) : flèches directionnelles réservées aux boutons de l'interface
 * - Raccourci 'S' pour sauter l'intro
 * - Raccourci 'F' / Plein Écran pour basculer le mode
 */
export function usePlayerControls({
  videoRef,
  isPlaying,
  setIsPlaying,
  isModalOpen,
  activeCastTarget,
  showToast,
  isFullscreen = false,
  onUserAction,
}: UsePlayerControlsProps) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      const v = videoRef.current;
      if (!v) return;

      const active = document.activeElement as HTMLElement | null;
      const isInput = !!(active && ['INPUT', 'TEXTAREA'].includes(active.tagName));
      if (isInput) return;

      // 1. Touche de raccourci 'S' pour sauter l'intro
      if (e.key === 's' || e.key === 'S') {
        const skipBtn = document.querySelector<HTMLElement>('[data-skip-intro="true"]');
        if (skipBtn) {
          e.preventDefault();
          onUserAction?.();
          skipBtn.click();
          showToast('Générique passé ⏭');
          return;
        }
      }

      // 2. Gestion de la touche Plein Écran universelle télécommande & clavier
      const isFullscreenKey =
        e.key === 'f' ||
        e.key === 'F' ||
        e.key === 'FullScreen' ||
        e.key === 'F11' ||
        [10071, 10072, 184, 261].includes(e.keyCode);

      if (isFullscreenKey) {
        e.preventDefault();
        const target =
          (document.querySelector('[data-player-container="true"]') as HTMLElement) ||
          document.documentElement;
        const entered = toggleFullscreen(target);
        showToast(entered ? '⛶ Plein écran activé' : 'Mode fenêtre');
        return;
      }

      // 3. Navigation Seek (ArrowLeft / ArrowRight) :
      // Strictement réservée au mode PLEIN ÉCRAN.
      // En mode normal avec les boutons affichés, les flèches naviguent entre les boutons !
      if (e.key === 'ArrowLeft') {
        if (!isFullscreen) return;
        e.preventDefault();
        onUserAction?.();
        const next = Math.max(0, v.currentTime - 10);
        v.currentTime = next;
        showToast(`⏪ -10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === 'ArrowRight') {
        if (!isFullscreen) return;
        e.preventDefault();
        onUserAction?.();
        const next = Math.min(v.duration || 7200, v.currentTime + 10);
        v.currentTime = next;
        showToast(`⏩ +10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === ' ' || e.key === 'MediaPlayPause') {
        // En mode normal avec un bouton sélectionné, laisser la touche espace activer le bouton
        if (!isFullscreen && active) {
          const isButton =
            ['BUTTON', 'A'].includes(active.tagName) ||
            active.getAttribute('role') === 'button' ||
            active.getAttribute('role') === 'link';
          if (isButton) return;
        }
        e.preventDefault();
        onUserAction?.();
        const next = !isPlaying;
        next ? v.play() : v.pause();
        setIsPlaying(next);
        showToast(next ? '▶ Lecture' : '⏸ Pause');
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, next ? 'PLAY' : 'PAUSE');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoRef, isPlaying, isModalOpen, activeCastTarget, isFullscreen, onUserAction]);
}
