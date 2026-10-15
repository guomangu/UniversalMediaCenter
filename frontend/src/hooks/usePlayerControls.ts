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
}

/**
 * Contrôleur média pour écran /player :
 * - Gestion plein écran via touche 'F', bouton télécommande ou bouton plein écran (avec debounce)
 * - Progression vidéo (ArrowLeft / ArrowRight) active lorsque l'utilisateur est en mode lecture
 * - Raccourci 'S' pour sauter le générique d'introduction
 * - La navigation directionnelle TV dans la barre supérieure n'interfère pas avec le seek
 */
export function usePlayerControls({
  videoRef,
  isPlaying,
  setIsPlaying,
  isModalOpen,
  activeCastTarget,
  showToast,
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

      const isTopBar = !!(
        active &&
        (active.getAttribute('data-player-topbar') === 'true' || !!active.closest('[data-player-topbar="true"]'))
      );
      const isSkipIntro = !!(
        active &&
        (active.getAttribute('data-skip-intro') === 'true' || !!active.closest('[data-skip-intro="true"]'))
      );

      // 1. Touche de raccourci 'S' pour sauter l'intro
      if (e.key === 's' || e.key === 'S') {
        const skipBtn = document.querySelector<HTMLElement>('[data-skip-intro="true"]');
        if (skipBtn) {
          e.preventDefault();
          skipBtn.click();
          showToast('Générique passé ⏩');
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
      // Actif uniquement si le focus n'est PAS dans les boutons de la barre supérieure ou passer l'intro
      if (e.key === 'ArrowLeft') {
        if (isTopBar || isSkipIntro) return; // Laisse la navigation TV aller d'un bouton à l'autre
        e.preventDefault();
        const next = Math.max(0, v.currentTime - 10);
        v.currentTime = next;
        showToast(`⏪ -10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === 'ArrowRight') {
        if (isTopBar || isSkipIntro) return; // Laisse la navigation TV aller d'un bouton à l'autre
        e.preventDefault();
        const next = Math.min(v.duration || 7200, v.currentTime + 10);
        v.currentTime = next;
        showToast(`⏩ +10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === ' ' || e.key === 'MediaPlayPause') {
        if (isTopBar || isSkipIntro) return; // Laisser la touche espace activer le bouton sélectionné
        if (active && ['BUTTON', 'A'].includes(active.tagName)) return;
        e.preventDefault();
        const next = !isPlaying;
        next ? v.play() : v.pause();
        setIsPlaying(next);
        showToast(next ? '▶ Lecture' : '⏸ Pause');
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, next ? 'PLAY' : 'PAUSE');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoRef, isPlaying, isModalOpen, activeCastTarget]);
}
