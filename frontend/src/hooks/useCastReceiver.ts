import { useEffect, useRef } from 'react';
import {
  registerAsReceiver,
  sendCastHeartbeat,
  pollDeviceCommands,
  getLocalDeviceId,
  getLocalDeviceName,
} from '@/services/castService';

interface UseCastReceiverProps {
  id: string;
  mediaTitle?: string;
  isPlaying: boolean;
  videoRef: React.RefObject<any>;
  setIsPlaying: (p: boolean) => void;
  setActiveAudio?: (a: string) => void;
  setActiveSubtitle?: (s: string) => void;
  onStop: () => void;
  onLoad?: (mediaId: string, payload?: any) => void;
}

export function useCastReceiver({
  id,
  mediaTitle,
  isPlaying,
  videoRef,
  setIsPlaying,
  setActiveAudio,
  setActiveSubtitle,
  onStop,
  onLoad,
}: UseCastReceiverProps) {
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const callbacksRef = useRef({
    setIsPlaying,
    setActiveAudio,
    setActiveSubtitle,
    onStop,
    onLoad,
  });
  callbacksRef.current = {
    setIsPlaying,
    setActiveAudio,
    setActiveSubtitle,
    onStop,
    onLoad,
  };

  useEffect(() => {
    if (!id) return;

    if (typeof registerAsReceiver === 'function') {
      registerAsReceiver(getLocalDeviceName(), {
        currentMediaId: id,
        mediaTitle: mediaTitle || `Média #${id}`,
        isPlaying: isPlayingRef.current,
        positionSeconds: videoRef.current?.currentTime || 0,
        durationSeconds: videoRef.current?.duration || 0,
      }).catch?.(() => {});
    }

    const interval = setInterval(() => {
      const v = videoRef.current;
      if (typeof sendCastHeartbeat === 'function') {
        sendCastHeartbeat({
          currentMediaId: id,
          mediaTitle: mediaTitle || `Média #${id}`,
          positionSeconds: v?.currentTime || 0,
          durationSeconds: v?.duration || 0,
          isPlaying: isPlayingRef.current,
          volume: v?.volume ?? 1,
          isMuted: v?.muted ?? false,
        }).catch?.(() => {});
      }

      if (typeof pollDeviceCommands === 'function') {
        pollDeviceCommands(getLocalDeviceId(), (cmd) => {
          const cb = callbacksRef.current;
          if (cmd.action === 'PAUSE') {
            cb.setIsPlaying(false);
            v?.pause?.();
          } else if (cmd.action === 'PLAY') {
            cb.setIsPlaying(true);
            v?.play?.();
          } else if (cmd.action === 'SEEK' && cmd.payload?.positionSeconds !== undefined && v) {
            v.currentTime = cmd.payload.positionSeconds;
          } else if (cmd.action === 'SET_VOLUME' && cmd.payload?.volume !== undefined && v) {
            v.volume = cmd.payload.volume;
          } else if (cmd.action === 'MUTE' && v) {
            v.muted = true;
          } else if (cmd.action === 'UNMUTE' && v) {
            v.muted = false;
          } else if (cmd.action === 'SET_AUDIO' && cmd.payload?.audio) {
            cb.setActiveAudio?.(cmd.payload.audio);
          } else if (cmd.action === 'SET_SUBTITLE' && cmd.payload?.subtitle) {
            cb.setActiveSubtitle?.(cmd.payload.subtitle);
          } else if (cmd.action === 'LOAD' && cmd.payload?.mediaId) {
            if (cmd.payload.mediaId === id) {
              if (cmd.payload.positionSeconds !== undefined && v) {
                v.currentTime = cmd.payload.positionSeconds;
              }
              cb.setIsPlaying(true);
              v?.play?.();
            } else {
              cb.onLoad?.(cmd.payload.mediaId, cmd.payload);
            }
          } else if (cmd.action === 'STOP') {
            cb.onStop();
          }
        }).catch?.(() => {});
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, mediaTitle]);
}
