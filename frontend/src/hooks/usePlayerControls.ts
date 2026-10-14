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

export function usePlayerControls({
  videoRef, isPlaying, setIsPlaying, isModalOpen, activeCastTarget, showToast,
}: UsePlayerControlsProps) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      const v = videoRef.current;
      if (!v) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = Math.max(0, v.currentTime - 10);
        v.currentTime = next;
        showToast(`⏪ -10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(v.duration || 7200, v.currentTime + 10);
        v.currentTime = next;
        showToast(`⏩ +10s (${Math.floor(next)}s)`);
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, 'SEEK', { positionSeconds: next });
      } else if (e.key === ' ' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        const next = !isPlaying;
        next ? v.play() : v.pause();
        setIsPlaying(next);
        showToast(next ? '▶ Lecture' : '⏸ Pause');
        if (activeCastTarget) sendCastCommand(activeCastTarget.id, next ? 'PLAY' : 'PAUSE');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        v.volume = Math.min(1, (v.volume || 1) + 0.1);
        showToast(`🔊 Volume : ${Math.round(v.volume * 100)}%`);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        v.volume = Math.max(0, (v.volume || 1) - 0.1);
        showToast(`🔉 Volume : ${Math.round(v.volume * 100)}%`);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoRef, isPlaying, isModalOpen, activeCastTarget]);
}
