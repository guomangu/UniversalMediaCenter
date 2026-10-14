import { useEffect } from 'react';
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
  onLoad?: (mediaId: string) => void;
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
  useEffect(() => {
    if (typeof registerAsReceiver === 'function') {
      registerAsReceiver(getLocalDeviceName(), {
        currentMediaId: id,
        mediaTitle: mediaTitle || `Média #${id}`,
        isPlaying,
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
          isPlaying,
          volume: v?.volume ?? 1,
          isMuted: v?.muted ?? false,
        }).catch?.(() => {});
      }

      if (typeof pollDeviceCommands === 'function') {
        pollDeviceCommands(getLocalDeviceId(), (cmd) => {
          if (cmd.action === 'PAUSE') {
            setIsPlaying(false);
            v?.pause?.();
          } else if (cmd.action === 'PLAY') {
            setIsPlaying(true);
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
            setActiveAudio?.(cmd.payload.audio);
          } else if (cmd.action === 'SET_SUBTITLE' && cmd.payload?.subtitle) {
            setActiveSubtitle?.(cmd.payload.subtitle);
          } else if (cmd.action === 'LOAD' && cmd.payload?.mediaId && cmd.payload.mediaId !== id) {
            onLoad?.(cmd.payload.mediaId);
          } else if (cmd.action === 'STOP') {
            onStop();
          }
        }).catch?.(() => {});
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [id, mediaTitle, isPlaying]);
}
