import { useEffect } from 'react';
import { Platform } from 'react-native';
import { sendCastCommand } from '@/services/castService';

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
 * - Progression vidéo (ArrowLeft / ArrowRight) active uniquement quand la vidéo est sélectionnée
 * - Pas de blocage ArrowUp / ArrowDown (réservé à la navigation spatiale TV de bouton en bouton)
 */
export function usePlayerControls({
  videoRef, isPlaying, setIsPlaying, isModalOpen, activeCastTarget, showToast,
}: UsePlayerControlsProps) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      const v = videoRef.current;
      if (!v) return;

      const active = document.activeElement as HTMLElement | null;
      // La vidéo est sélectionnée si elle ou son conteneur possède le focus actif
      const isVideoSelected = !!(
        active &&
        (active === v || v.contains(active) || active.getAttribute('data-video-player') === 'true')
      );

      if (e.key === 'ArrowLeft') {
        if (!isVideoSelected) return; // Laisse la navigation TV aller de bouton en bouton
        e.preventDefault();
        const next = Math.max(0, v.currentTime - 10);
        v.currentTime = next;
        showToast(`⏪ -10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === 'ArrowRight') {
        if (!isVideoSelected) return; // Laisse la navigation TV aller de bouton en bouton
        e.preventDefault();
        const next = Math.min(v.duration || 7200, v.currentTime + 10);
        v.currentTime = next;
        showToast(`⏩ +10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === ' ' || e.key === 'MediaPlayPause') {
        if (['INPUT', 'TEXTAREA'].includes(active?.tagName || '')) return;
        if (active && ['BUTTON', 'A'].includes(active.tagName) && !isVideoSelected) return;
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
