export type DeviceType = 'TV' | 'BROWSER' | 'MOBILE' | 'CHROMECAST' | 'AIRPLAY';

export interface CastDevice {
  id: string;
  name: string;
  deviceType: DeviceType;
  ipAddress?: string;
  currentMediaId?: string;
  mediaTitle?: string;
  posterUrl?: string;
  streamUrl?: string;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  volume: number;
  isMuted?: boolean;
  audioTrack?: string;
  subtitleTrack?: string;
  lastSeenAt: number;
}

export interface CastCommand {
  id: string;
  targetDeviceId: string;
  action: 'LOAD' | 'PLAY' | 'PAUSE' | 'SEEK' | 'STOP' | 'SET_VOLUME' | 'MUTE' | 'UNMUTE' | 'SET_AUDIO' | 'SET_SUBTITLE';
  payload?: {
    mediaId?: string;
    title?: string;
    posterUrl?: string;
    streamUrl?: string;
    positionSeconds?: number;
    volume?: number;
    audioTrack?: string;
    subtitleTrack?: string;
  };
  createdAt: number;
}
