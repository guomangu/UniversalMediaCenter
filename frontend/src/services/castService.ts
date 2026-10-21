import { getApiBaseUrl } from './apiConfig';
import { getAuthToken, getAuthHeaders } from './authStore';
import {
  getLocalDeviceId,
  getLocalDeviceName,
  setLocalDeviceName,
} from './deviceIdentity';
import { fetchMediaTracks } from './mediaTracksApi';
import type { MediaTracksData } from './mediaTracksApi';
import { getVideoStreamUrl } from './api';

export { getLocalDeviceId, getLocalDeviceName, setLocalDeviceName };

/** Identifiant virtuel de la session Google Cast native (Chromecast / Google TV). */
export const NATIVE_CAST_DEVICE_ID = 'native_google_cast';

export function isNativeCastDeviceId(id?: string | null): boolean {
  return id === NATIVE_CAST_DEVICE_ID;
}

interface NativeCastSessionState {
  media: CastMediaPayload;
  streamUrl: string;
  tracks?: MediaTracksData;
  activeAudio: string;
  activeSubtitle: string;
  subtitleTrackMap: Map<string, number>;
}

let nativeCastSessionState: NativeCastSessionState | null = null;

function getGoogleCastFramework(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).cast?.framework || null;
}

function getGoogleCastChrome(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).chrome?.cast || null;
}

function getNativeCastContext(): any {
  const framework = getGoogleCastFramework();
  if (!framework?.CastContext) return null;
  try {
    return framework.CastContext.getInstance();
  } catch {
    return null;
  }
}

function getNativeCastSession(): any {
  const context = getNativeCastContext();
  try {
    return context?.getCurrentSession?.() || null;
  } catch {
    return null;
  }
}

function getNativeMediaSession(): any {
  const session = getNativeCastSession();
  try {
    return session?.getMediaSession?.() || null;
  } catch {
    return null;
  }
}

/**
 * État temps réel de la session Google Cast native, exposé sous la même forme
 * qu'un appareil du registre UMS. C'est ce qui permet à la télécommande, au
 * scrubber et aux menus audio/sous-titres de continuer à piloter le Chromecast.
 */
export function getNativeCastDeviceState(): CastDevice | null {
  const session = getNativeCastSession();
  if (!session) return null;

  const mediaSession = getNativeMediaSession();
  const mediaInfo = mediaSession?.media || null;
  const metadata = mediaInfo?.metadata || null;
  const playerState = String(mediaSession?.playerState || 'IDLE').toUpperCase();

  let position = 0;
  try {
    position = Number(mediaSession?.getEstimatedTime?.() ?? 0) || 0;
  } catch {}

  let volume = 1;
  let isMuted = false;
  try {
    volume = typeof session.getVolume === 'function' ? Number(session.getVolume()) : 1;
    isMuted = typeof session.isMute === 'function' ? Boolean(session.isMute()) : false;
  } catch {}

  const activeTrackIds: number[] = Array.isArray(mediaSession?.getActiveTrackIds?.())
    ? mediaSession.getActiveTrackIds()
    : [];
  const tracks: any[] = Array.isArray(mediaInfo?.tracks) ? mediaInfo.tracks : [];
  const activeTextTrack = tracks.find(
    (t) => activeTrackIds.includes(t.trackId) && String(t.type).toUpperCase() === 'TEXT'
  );

  let castDevice: any = null;
  try {
    castDevice = session.getCastDevice?.() || null;
  } catch {}

  // Après un rechargement de page, l'état JS local est perdu mais la session
  // Google Cast peut avoir été restaurée. On reconstruit le contexte depuis le
  // contentId pour conserver la télécommande et le changement de piste audio.
  if (!nativeCastSessionState && mediaInfo) {
    const contentId = String(mediaInfo.contentId || mediaInfo.contentUrl || '');
    const mediaMatch = contentId.match(/\/api\/media\/([^/?#]+)\/(?:hls|stream)/i);
    if (mediaMatch?.[1]) {
      let share: string | undefined;
      let audioParam = 'auto';
      try {
        const u = new URL(contentId);
        share = u.searchParams.get('share') || undefined;
        audioParam = u.searchParams.get('audio') || 'auto';
      } catch {}

      const rebuiltMap = new Map<string, number>();
      for (const track of tracks) {
        if (String(track.type).toUpperCase() !== 'TEXT') continue;
        try {
          const u = new URL(String(track.trackContentId || ''));
          const fileName = u.searchParams.get('fileName');
          const trackIndex = u.searchParams.get('trackIndex');
          if (fileName) rebuiltMap.set(`file:${fileName}`, track.trackId);
          if (trackIndex) rebuiltMap.set(`track:${trackIndex}`, track.trackId);
        } catch {}
        if (track.language) rebuiltMap.set(track.language, track.trackId);
      }

      nativeCastSessionState = {
        media: {
          id: mediaMatch[1],
          title: metadata?.title || 'Média en cours',
          streamUrl: contentId,
          posterUrl: metadata?.images?.[0]?.url,
          share,
        },
        streamUrl: contentId,
        activeAudio: audioParam,
        activeSubtitle: activeTextTrack?.language || 'off',
        subtitleTrackMap: rebuiltMap,
      };
    }
  }

  return {
    id: NATIVE_CAST_DEVICE_ID,
    name: castDevice?.friendlyName || 'Google Cast',
    deviceType: 'CHROMECAST',
    currentMediaId: nativeCastSessionState?.media.id,
    mediaTitle:
      metadata?.title || nativeCastSessionState?.media.title || 'Média en cours',
    posterUrl:
      metadata?.images?.[0]?.url || nativeCastSessionState?.media.posterUrl,
    positionSeconds: Math.max(0, Math.floor(position)),
    durationSeconds:
      Math.max(0, Math.floor(Number(mediaInfo?.duration || 0))) ||
      nativeCastSessionState?.media.durationSeconds ||
      0,
    isPlaying: playerState === 'PLAYING' || playerState === 'BUFFERING',
    volume,
    isMuted,
    audioTrack: nativeCastSessionState?.activeAudio || 'auto',
    subtitleTrack:
      nativeCastSessionState?.activeSubtitle ||
      activeTextTrack?.language ||
      'off',
    lastSeen: new Date().toISOString(),
  };
}

function withQueryParam(url: string, key: string, value: string): string {
  if (!url || !value) return url;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    return url;
  }
}

function getStreamOrigin(url: string): string {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${u.protocol}//${u.host}`;
  } catch {
    return getApiBaseUrl();
  }
}

async function buildNativeCastStreamUrl(
  media: CastMediaPayload,
  tracks: MediaTracksData | null,
  audio: string
): Promise<{ url: string; contentType: string }> {
  // Chromecast ne sait pas lire un MKV direct ni changer de piste audio dans un
  // conteneur non-HLS : on privilégie le HLS dès que le média l'exige ou qu'il
  // contient plusieurs pistes audio.
  const needsHls =
    Boolean(media.isLive) ||
    Boolean(tracks?.requiresHls) ||
    (tracks?.audioTracks?.length || 0) > 1 ||
    Boolean(media.streamUrl?.includes('.m3u8')) ||
    // Si l'analyse des pistes a échoué, HLS reste le format le plus sûr pour
    // un Chromecast (il ne lit pas les conteneurs MKV en direct).
    (!tracks && Boolean(media.id));

  let raw: string;
  if (media.id) {
    raw = getVideoStreamUrl(media.id, media.share, needsHls);
  } else {
    raw = media.streamUrl || '';
  }

  let url = await resolveLanStreamUrl(raw, media.id);
  if (audio && audio !== 'auto') url = withQueryParam(url, 'audio', audio);

  const isHls = needsHls || url.includes('.m3u8');
  return {
    url,
    // Le Default Media Receiver Google Cast attend le MIME historique
    // application/x-mpegurl pour les playlists HLS.
    contentType: isHls ? 'application/x-mpegurl' : 'video/mp4',
  };
}

function buildNativeMediaInfo(
  streamUrl: string,
  contentType: string,
  media: CastMediaPayload,
  tracks: MediaTracksData | null,
  activeSubtitle: string
): { mediaInfo: any; activeTrackIds: number[]; subtitleTrackMap: Map<string, number> } {
  const chromeCast = getGoogleCastChrome();
  const mediaInfo = new chromeCast.media.MediaInfo(streamUrl, contentType);
  mediaInfo.streamType = media.isLive
    ? chromeCast.media.StreamType.LIVE
    : chromeCast.media.StreamType.BUFFERED;

  mediaInfo.metadata = new chromeCast.media.GenericMediaMetadata();
  mediaInfo.metadata.title = media.title;
  if (media.posterUrl) {
    mediaInfo.metadata.images = [{ url: media.posterUrl }];
  }

  const subtitleTrackMap = new Map<string, number>();
  const activeTrackIds: number[] = [];
  const castTracks: any[] = [];
  const subtitleTracks = tracks?.subtitleTracks || [];

  if (subtitleTracks.length > 0 && chromeCast?.media?.Track) {
    const origin = getStreamOrigin(streamUrl);
    subtitleTracks.forEach((s, idx) => {
      const trackId = 1000 + (Number(s.index) || idx) + idx;
      const track = new chromeCast.media.Track(trackId, chromeCast.media.TrackType.TEXT);
      const params = new URLSearchParams();
      const token = getAuthToken();
      if (media.share) params.set('share', media.share);
      else if (token) params.set('token', token);
      if (s.fileName) params.set('fileName', s.fileName);
      else params.set('trackIndex', String(s.index));

      track.trackContentId = `${origin}/api/media/${media.id}/subtitles?${params.toString()}`;
      track.trackContentType = 'text/vtt';
      track.subtype = chromeCast.media.TextTrackType?.SUBTITLES || 'SUBTITLES';
      track.name = s.label || `Sous-titre ${idx + 1}`;
      track.language = s.language || 'und';
      castTracks.push(track);

      const keys = [
        s.fileName ? `file:${s.fileName}` : '',
        `track:${s.index}`,
        String(s.index),
        s.language,
      ].filter(Boolean) as string[];
      for (const key of keys) subtitleTrackMap.set(key, trackId);
    });
    mediaInfo.tracks = castTracks;

    const wantedId = subtitleTrackMap.get(activeSubtitle);
    if (wantedId) activeTrackIds.push(wantedId);
  }

  return { mediaInfo, activeTrackIds, subtitleTrackMap };
}

function noopCastCallback() {}

function editNativeTracks(activeTrackIds: number[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const mediaSession = getNativeMediaSession();
    const chromeCast = getGoogleCastChrome();
    if (!mediaSession || !chromeCast) return reject(new Error('Session Cast inactive'));
    mediaSession.editTracksInfo(
      new chromeCast.media.EditTracksInfoRequest(activeTrackIds),
      () => resolve(),
      (err: any) => reject(err)
    );
  });
}

async function reloadNativeCastMedia(overrides: {
  audio?: string;
  subtitle?: string;
} = {}): Promise<boolean> {
  const session = getNativeCastSession();
  const chromeCast = getGoogleCastChrome();
  if (!session || !chromeCast || !nativeCastSessionState) return false;

  const state = nativeCastSessionState;
  const audio = overrides.audio !== undefined ? overrides.audio : state.activeAudio;
  const subtitle =
    overrides.subtitle !== undefined ? overrides.subtitle : state.activeSubtitle;
  const live = getNativeCastDeviceState();
  const position = live?.positionSeconds || 0;
  const wasPlaying = live?.isPlaying ?? true;

  if (!state.tracks && state.media.id) {
    state.tracks = (await fetchMediaTracks(state.media.id, state.media.share).catch(() => null)) || undefined;
  }

  const { url, contentType } = await buildNativeCastStreamUrl(state.media, state.tracks || null, audio);
  const { mediaInfo, activeTrackIds, subtitleTrackMap } = buildNativeMediaInfo(
    url,
    contentType,
    state.media,
    state.tracks || null,
    subtitle
  );

  const request = new chromeCast.media.LoadRequest(mediaInfo);
  request.autoplay = wasPlaying;
  if (position > 0) request.currentTime = position;
  if (activeTrackIds.length > 0) request.activeTrackIds = activeTrackIds;

  await session.loadMedia(request);
  nativeCastSessionState = {
    ...state,
    streamUrl: url,
    activeAudio: audio,
    activeSubtitle: subtitle,
    subtitleTrackMap,
  };
  return true;
}

async function applyNativeSubtitle(subtitle: string): Promise<boolean> {
  const chromeCast = getGoogleCastChrome();
  const mediaSession = getNativeMediaSession();
  if (!chromeCast || !mediaSession) return false;

  if (!subtitle || subtitle === 'off') {
    await editNativeTracks([]).catch(() => {});
    if (nativeCastSessionState) nativeCastSessionState.activeSubtitle = 'off';
    return true;
  }

  const mappedId = nativeCastSessionState?.subtitleTrackMap.get(subtitle);
  const tracks: any[] = Array.isArray(mediaSession.media?.tracks) ? mediaSession.media.tracks : [];
  const fallback = tracks.find((t: any) => {
    if (String(t.type).toUpperCase() !== 'TEXT') return false;
    if (subtitle.startsWith('track:')) return String(t.trackId) === subtitle.slice(6);
    if (subtitle.startsWith('file:')) return String(t.trackContentId || '').includes(subtitle.slice(5));
    return t.language === subtitle;
  });

  const trackId = mappedId || fallback?.trackId;
  if (trackId) {
    await editNativeTracks([trackId]).catch(() => {});
    if (nativeCastSessionState) nativeCastSessionState.activeSubtitle = subtitle;
    return true;
  }

  // Piste absente du MediaInfo chargé : rechargement au même timestamp avec le
  // sous-titre demandé (cas d'une piste ajoutée après le début du Cast).
  return reloadNativeCastMedia({ subtitle });
}

async function sendNativeCastCommand(action: CastAction, payload?: any): Promise<boolean> {
  const session = getNativeCastSession();
  const mediaSession = getNativeMediaSession();
  const chromeCast = getGoogleCastChrome();
  if (!session || !chromeCast) return false;

  try {
    switch (action) {
      case 'PLAY':
        if (!mediaSession) return false;
        mediaSession.play(new chromeCast.media.PlayRequest(), noopCastCallback, noopCastCallback);
        return true;
      case 'PAUSE':
        if (!mediaSession) return false;
        mediaSession.pause(new chromeCast.media.PauseRequest(), noopCastCallback, noopCastCallback);
        return true;
      case 'SEEK': {
        if (!mediaSession) return false;
        const seekReq = new chromeCast.media.SeekRequest();
        seekReq.currentTime = Number(payload?.positionSeconds || 0);
        mediaSession.seek(seekReq, noopCastCallback, noopCastCallback);
        return true;
      }
      case 'SET_VOLUME': {
        const volume = Math.max(0, Math.min(1, Number(payload?.volume ?? 1)));
        if (typeof session.setVolume === 'function') {
          session.setVolume(volume);
        } else if (typeof session.setVolumeLevel === 'function') {
          session.setVolumeLevel(volume);
        }
        return true;
      }
      case 'MUTE':
        if (typeof session.setMute === 'function') session.setMute(true);
        else if (typeof session.mute === 'function') session.mute();
        return true;
      case 'UNMUTE':
        if (typeof session.setMute === 'function') session.setMute(false);
        else if (typeof session.unmute === 'function') session.unmute();
        return true;
      case 'SET_SUBTITLE':
        return await applyNativeSubtitle(String(payload?.subtitle || 'off'));
      case 'SET_AUDIO':
        return await reloadNativeCastMedia({ audio: String(payload?.audio || 'auto') });
      case 'LOAD':
        return await reloadNativeCastMedia({
          audio: String(payload?.activeAudio || 'auto'),
          subtitle: String(payload?.activeSubtitle || 'off'),
        });
      case 'STOP': {
        const context = getNativeCastContext();
        try {
          context?.endCurrentSession?.(true);
        } catch {}
        nativeCastSessionState = null;
        return true;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

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
  durationSeconds?: number;
  isLive?: boolean;
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
    const res = await fetch(`${getApiBaseUrl()}/api/cast/devices`, {
      headers: getAuthHeaders(),
    }).catch(() => null);
    if (!res || !res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.devices || []).filter((d: CastDevice) => d.id !== getLocalDeviceId());
  } catch {
    return [];
  }
}

export async function fetchDeviceStatus(deviceId: string): Promise<CastDevice | null> {
  // La session Google Cast native ne passe pas par le registre serveur :
  // son état est lu directement dans le SDK du récepteur.
  if (isNativeCastDeviceId(deviceId)) return getNativeCastDeviceState();
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/cast/device/${deviceId}`, {
      headers: getAuthHeaders(),
    }).catch(() => null);
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
  device?: CastDevice;
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

  // 1. Google Cast SDK officiel (Chromecast, Google TV, Android TV)
  if (cast?.framework && chrome?.cast) {
    try {
      const instance = cast.framework.CastContext.getInstance();
      await instance.requestSession();
      const session = instance.getCurrentSession();
      if (!session) {
        return {
          success: false,
          target: 'NONE',
          message: 'Aucune session Google Cast active.',
        };
      }

      // Connexion sans média (bouton « Connecter »)
      if (!media) {
        const device = getNativeCastDeviceState();
        return {
          success: true,
          target: 'GOOGLE_CAST',
          message: 'Connecté via Google Cast',
          device: device || undefined,
        };
      }

      const tracks = await fetchMediaTracks(media.id, media.share).catch(() => null);
      const activeAudio = media.activeAudio || 'auto';
      const activeSubtitle = media.activeSubtitle || 'off';
      const { url, contentType } = await buildNativeCastStreamUrl(media, tracks, activeAudio);
      const { mediaInfo, activeTrackIds, subtitleTrackMap } = buildNativeMediaInfo(
        url,
        contentType,
        media,
        tracks,
        activeSubtitle
      );

      const request = new chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      if (media.positionSeconds && media.positionSeconds > 0) {
        request.currentTime = media.positionSeconds;
      }
      if (activeTrackIds.length > 0) request.activeTrackIds = activeTrackIds;

      await session.loadMedia(request);

      // Mémoriser le contexte : c'est lui qui permet ensuite de changer de piste
      // audio (rechargement HLS) ou de réappliquer un sous-titre.
      nativeCastSessionState = {
        media: { ...media, streamUrl: url },
        streamUrl: url,
        tracks: tracks || undefined,
        activeAudio,
        activeSubtitle,
        subtitleTrackMap,
      };

      const remoteState = getNativeCastDeviceState();
      const castDevice: CastDevice = remoteState || {
        id: NATIVE_CAST_DEVICE_ID,
        name: session.getCastDevice?.()?.friendlyName || 'Google Cast',
        deviceType: 'CHROMECAST',
        currentMediaId: media.id,
        mediaTitle: media.title,
        posterUrl: media.posterUrl,
        positionSeconds: media.positionSeconds || 0,
        durationSeconds: media.durationSeconds || 0,
        isPlaying: true,
        audioTrack: activeAudio,
        subtitleTrack: activeSubtitle,
      };

      return {
        success: true,
        target: 'GOOGLE_CAST',
        message: 'Connecté via Google Cast',
        device: castDevice,
      };
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
  // La cible Google Cast native est pilotée directement par le SDK local :
  // aucune commande ne doit être envoyée au registre serveur (le Chromecast
  // ne sonde pas /api/cast/poll).
  if (isNativeCastDeviceId(targetDeviceId)) {
    return await sendNativeCastCommand(action, payload);
  }

  try {
    const p1 = fetch(`${getApiBaseUrl()}/api/cast/command`, {
      method: 'POST',
      headers: getAuthHeaders(),
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

export function endGoogleCastSession(stopCasting = true): void {
  if (typeof window === "undefined") return;
  try {
    const cast = (window as any).cast;
    if (cast?.framework) {
      const instance = cast.framework.CastContext.getInstance();
      instance.endCurrentSession(Boolean(stopCasting));
    }
  } catch (e) {
    console.warn("Google Cast disconnect error:", e);
  } finally {
    nativeCastSessionState = null;
  }
}
