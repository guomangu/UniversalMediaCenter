import { getApiBaseUrl } from './apiConfig';
import { getAuthToken, getAuthHeaders } from './authStore';
import {
  getLocalDeviceId,
  getLocalDeviceName,
  setLocalDeviceName,
} from './deviceIdentity';
import { fetchMediaTracks } from './mediaTracksApi';

export { getLocalDeviceId, getLocalDeviceName, setLocalDeviceName };

export type DeviceType = 'TV' | 'CHROMECAST' | 'AIRPLAY' | 'BROWSER' | 'MOBILE';

export interface CastDevice {
  id: string;
  name: string;
  deviceType: DeviceType;
  currentMediaId?: string;
  mediaTitle?: string;
  posterUrl?: string;
  positionSeconds?: number;
  durationSeconds?: number;
  isPlaying?: boolean;
  volume?: number;
  isMuted?: boolean;
  audioTrack?: string;
  subtitleTrack?: string;
  lastSeen?: string;
}

export interface CastMediaPayload {
  id: string;
  title: string;
  streamUrl?: string;
  posterUrl?: string;
  positionSeconds?: number;
  activeSubtitle?: string;
  activeAudio?: string;
  share?: string;
}

export type CastAction =
  | 'LOAD'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'STOP'
  | 'SET_VOLUME'
  | 'MUTE'
  | 'UNMUTE'
  | 'SET_AUDIO'
  | 'SET_SUBTITLE';

export async function fetchCastServerInfo(): Promise<{ lanIp: string; port: number; gatewayPort: number } | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/info`).catch(() => null);
    if (!res || !res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function fetchCastDevices(): Promise<CastDevice[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/devices`).catch(() => null);
    if (!res || !res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.devices || []).filter((d: CastDevice) => d.id !== getLocalDeviceId());
  } catch {
    return [];
  }
}

export async function fetchDeviceStatus(deviceId: string): Promise<CastDevice | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/device/${deviceId}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.device || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Initialise le framework Google Cast officiel du navigateur
 */
export function initGoogleCastFramework(): void {
  if (typeof window === 'undefined') return;

  const configureContext = () => {
    try {
      if ((window as any).cast?.framework && (window as any).chrome?.cast) {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        castContext.setOptions({
          receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped',
        });
      }
    } catch (e) {
      console.warn('Google Cast init error:', e);
    }
  };

  if ((window as any).cast?.framework) {
    configureContext();
  } else {
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        configureContext();
      }
    };
  }
}

/**
 * Résout une URL de flux accessible sur le LAN pour le récepteur Cast
 */
export async function resolveLanStreamUrl(rawUrl?: string, mediaId?: string): Promise<string> {
  let url = rawUrl;
  if (!url && mediaId) {
    url = `${getApiBaseUrl()}/api/media/${mediaId}/stream`;
  }
  if (!url) return '';

  const serverInfo = await fetchCastServerInfo();
  const lanIp = serverInfo?.lanIp || '192.168.1.93';

  // Si l'URL pointe vers localhost ou 127.0.0.1, substituer par l'IP LAN accessible du serveur
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    url = url.replace(/localhost|127\.0\.0\.1/g, lanIp);
  }

  // Si l'URL est relative
  if (url.startsWith('/')) {
    const port = serverInfo?.gatewayPort || 8080;
    url = `http://${lanIp}:${port}${url}`;
  }

  // Joindre le jeton d'authentification pour que le Chromecast puisse lire le flux sans cookies
  const token = getAuthToken();
  if (token && !url.includes('token=') && !url.includes('share=')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}token=${encodeURIComponent(token)}`;
  }

  return url;
}

export interface NativeCastResult {
  success: boolean;
  message?: string;
  target?: 'GOOGLE_CAST' | 'REMOTE_PLAYBACK' | 'AIRPLAY' | 'NONE';
}

/**
 * Déclenche le Cast natif (Google Cast / Chromecast, AirPlay, ou HTML5 Remote Playback)
 */
export async function triggerNativeCast(media?: CastMediaPayload): Promise<NativeCastResult> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Non supporté hors environnement web' };
  }

  const cast = (window as any).cast;
  const chrome = (window as any).chrome;

  // Résolution de l'URL LAN certifiée
  const lanStreamUrl = await resolveLanStreamUrl(media?.streamUrl, media?.id);

  // 1. Google Cast SDK officiel (Chromecast, Google TV, Android TV)
  if (cast?.framework && chrome?.cast) {
    try {
      const instance = cast.framework.CastContext.getInstance();
      await instance.requestSession();
      const session = instance.getCurrentSession();
      if (session && media) {
        const contentType = lanStreamUrl.includes('.m3u8') ? 'application/x-mpegurl' : 'video/mp4';
        const mediaInfo = new chrome.cast.media.MediaInfo(lanStreamUrl, contentType);
        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = media.title;
        if (media.posterUrl) {
          mediaInfo.metadata.images = [{ url: media.posterUrl }];
        }

        const request = new chrome.cast.media.LoadRequest(mediaInfo);
        if (media.positionSeconds && media.positionSeconds > 0) {
          request.currentTime = media.positionSeconds;
        }

        // Intégration des sous-titres dans la session Google Cast
        try {
          const trackData = await fetchMediaTracks(media.id, media.share).catch(() => null);
          if (trackData?.subtitleTracks && trackData.subtitleTracks.length > 0 && chrome?.cast?.media?.Track) {
            const castTracks: any[] = [];
            let activeTrackId: number | null = null;

            trackData.subtitleTracks.forEach((s, idx) => {
              const trackId = s.index || (idx + 1);
              const track = new chrome.cast.media.Track(trackId, chrome.cast.media.TrackType.TEXT);
              const p = new URLSearchParams();
              const token = getAuthToken();
              if (token) p.set('token', token);
              if (media.share) p.set('share', media.share);
              if (s.fileName) {
                p.set('fileName', s.fileName);
              } else {
                p.set('trackIndex', String(s.index));
              }
              // Utiliser la même origine que le flux : elle est déjà joignable par le récepteur
              // (domaine public HTTPS ou IP LAN selon le déploiement).
              track.trackContentId = `${getApiBaseUrl()}/api/media/${media.id}/subtitles?${p.toString()}`;
              track.trackContentType = 'text/vtt';
              track.subtype = chrome.cast.media.TextTrackType.SUBTITLES;
              track.name = s.label || 'Sous-titre';
              track.language = s.language || 'fr';
              castTracks.push(track);

              const subVal = s.fileName ? `file:${s.fileName}` : `track:${s.index}`;
              if (media.activeSubtitle && (media.activeSubtitle === subVal || media.activeSubtitle === s.language)) {
                activeTrackId = trackId;
              }
            });

            mediaInfo.tracks = castTracks;
            if (activeTrackId !== null) {
              request.activeTrackIds = [activeTrackId];
            }
          }
        } catch (subErr) {
          console.warn('Google Cast subtitle load error:', subErr);
        }

        await session.loadMedia(request);
        return { success: true, target: 'GOOGLE_CAST', message: 'Connecté via Google Cast' };
      }
    } catch (err: any) {
      if (err?.code !== 'cancel') {
        console.warn('Google Cast requestSession notice:', err);
      }
    }
  }

  // 2. AirPlay natif pour Safari / Apple WebKit
  const video = (document.querySelector('video[data-video-player="true"]') ||
    document.querySelector('video')) as any;

  if (video && typeof video.webkitShowPlaybackTargetPicker === 'function') {
    try {
      video.webkitShowPlaybackTargetPicker();
      return { success: true, target: 'AIRPLAY', message: 'Sélecteur AirPlay ouvert' };
    } catch (err) {
      console.warn('AirPlay picker notice:', err);
    }
  }

  // 3. HTML5 Remote Playback API standard (Chromecast & écrans sans fil du navigateur)
  if (video?.remote && typeof video.remote.prompt === 'function') {
    try {
      await video.remote.prompt();
      return { success: true, target: 'REMOTE_PLAYBACK', message: 'Sélecteur d’écrans sans fil ouvert' };
    } catch (err: any) {
      if (err?.name !== 'NotFoundError' && err?.name !== 'NotAllowedError') {
        console.warn('Remote Playback notice:', err);
      }
    }
  }

  // 4. W3C Presentation API
  if ((window as any).PresentationRequest) {
    try {
      const pReq = new (window as any).PresentationRequest(['https://www.google.com/chromecast']);
      await pReq.start();
      return { success: true, target: 'GOOGLE_CAST', message: 'Diffusion lancée' };
    } catch {}
  }

  return {
    success: false,
    target: 'NONE',
    message: 'Aucun récepteur Google Cast ou AirPlay actif détecté. Vérifiez que votre TV est allumée sur le même réseau Wi-Fi.',
  };
}

export async function registerAsReceiver(name: string, state: Partial<CastDevice>): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getLocalDeviceId(), name, deviceType: 'BROWSER', ...state }),
    }).catch(() => null);
  } catch {}
}

export async function sendCastHeartbeat(state: Partial<CastDevice>): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/cast/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getLocalDeviceId(), ...state }),
    }).catch(() => null);
  } catch {}
}

export async function sendCastCommand(targetDeviceId: string, action: CastAction, payload?: any): Promise<boolean> {
  try {
    // 0. Si une session Google Cast est active, appliquer les commandes directement sur le Chromecast
    if (typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        const session = castContext?.getCurrentSession();
        const mediaSession = session?.getMediaSession();
        const chromeCast = (window as any).chrome?.cast;

        if (mediaSession && chromeCast) {
          if (action === 'PLAY') {
            mediaSession.play(new chromeCast.media.PlayRequest(), () => {}, () => {});
          } else if (action === 'PAUSE') {
            mediaSession.pause(new chromeCast.media.PauseRequest(), () => {}, () => {});
          } else if (action === 'SEEK' && typeof payload?.positionSeconds === 'number') {
            const seekReq = new chromeCast.media.SeekRequest();
            seekReq.currentTime = payload.positionSeconds;
            mediaSession.seek(seekReq, () => {}, () => {});
          } else if (action === 'SET_VOLUME' && typeof payload?.volume === 'number') {
            const volReq = new chromeCast.media.VolumeRequest(new chromeCast.media.Volume(payload.volume));
            mediaSession.setVolume(volReq, () => {}, () => {});
          } else if (action === 'SET_SUBTITLE') {
            const sub = payload?.subtitle;
            if (!sub || sub === 'off') {
              mediaSession.editTracksInfo(
                new chromeCast.media.EditTracksInfoRequest([]),
                () => {},
                () => {}
              );
            } else {
              const tracks = mediaSession.media?.tracks || [];
              const match = tracks.find((t: any) => {
                if (sub.startsWith('track:')) return String(t.trackId) === sub.slice(6);
                if (sub.startsWith('file:')) return t.trackContentId?.includes(sub.slice(5));
                return t.language === sub;
              });
              const activeIds = match ? [match.trackId] : [];
              mediaSession.editTracksInfo(
                new chromeCast.media.EditTracksInfoRequest(activeIds),
                () => {},
                () => {}
              );
            }
          }
        }
      } catch (e) {
        console.warn('Native Google Cast command relay warning:', e);
      }
    }

    const p1 = fetch(`${getApiBaseUrl()}/api/cast/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDeviceId, action, payload }),
    }).catch(() => null);

    const token = getAuthToken();
    let p2 = Promise.resolve(null as any);
    if (token) {
      const devActionMap: Record<string, string> = {
        LOAD: 'LOAD_MEDIA',
        PLAY: 'PLAY',
        PAUSE: 'PAUSE',
        SEEK: 'SEEK',
        STOP: 'STOP',
        SET_VOLUME: 'SET_VOLUME',
        MUTE: 'MUTE',
        UNMUTE: 'UNMUTE',
      };
      const devAction = devActionMap[action] || action;
      p2 = fetch(`${getApiBaseUrl()}/api/user/devices/command`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'X-Device-Id': getLocalDeviceId(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetDeviceId, action: devAction, payload }),
      }).catch(() => null);
    }

    const [res1, res2] = await Promise.all([p1, p2]);
    return Boolean((res1 && res1.ok) || (res2 && res2.ok));
  } catch {
    return false;
  }
}

export async function pollDeviceCommands(deviceId: string, onCommand: (cmd: any) => void): Promise<void> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/poll/${deviceId}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.commands && Array.isArray(data.commands)) {
        for (const cmd of data.commands) onCommand(cmd);
      }
    }
  } catch {}
}

export function endGoogleCastSession(): void {
  if (typeof window === "undefined") return;
  try {
    const cast = (window as any).cast;
    if (cast?.framework) {
      const instance = cast.framework.CastContext.getInstance();
      instance.endCurrentSession(true);
    }
  } catch (e) {
    console.warn("Google Cast disconnect error:", e);
  }
}
