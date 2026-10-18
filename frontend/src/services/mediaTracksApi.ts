import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders, getAuthToken } from './authStore';

export interface MediaTracksData {
  audioTracks: { index: number; language: string; label: string; codec: string }[];
  subtitleTracks: { index: number; language: string; label: string; fileName?: string }[];
  qualities: { label: string; value: string }[];
  intro?: { start: number; end: number };
  duration?: number;
  durationSeconds?: number;
  videoCodec?: string;
  isVideoNative?: boolean;
  requiresHls?: boolean;
  streamType?: 'hls' | 'direct';
  defaultAudioTrack?: string;
  defaultSubtitle?: string;
  isDefaultAudioAvailable?: boolean;
  subtitleFallbackTriggered?: boolean;
  configuredAudioLanguage?: string;
  configuredSubtitleLanguage?: string;
  subtitleMode?: string;
}

export async function fetchMediaTracks(id: string, shareToken?: string | null): Promise<MediaTracksData> {
  try {
    const token = getAuthToken();
    const p = new URLSearchParams();
    if (shareToken) p.set('share', shareToken);
    else if (token) p.set('token', token);
    const qs = p.toString();
    const url = `${getApiBaseUrl()}/api/media/${id}/tracks${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
      },
      credentials: 'include',
    });

    if (!res.ok) {
      console.warn(`[fetchMediaTracks] HTTP ${res.status} on ${url}`);
      return { audioTracks: [], subtitleTracks: [], qualities: [] };
    }

    const data = await res.json();
    return {
      audioTracks: Array.isArray(data.audioTracks) ? data.audioTracks : [],
      subtitleTracks: Array.isArray(data.subtitleTracks) ? data.subtitleTracks : [],
      qualities: Array.isArray(data.qualities) ? data.qualities : [],
      intro: data.intro,
      duration: data.durationSeconds || data.duration,
      durationSeconds: data.durationSeconds,
      videoCodec: data.videoCodec,
      isVideoNative: data.isVideoNative,
      requiresHls: Boolean(data.requiresHls),
      streamType: data.streamType || (data.requiresHls ? 'hls' : 'direct'),
      defaultAudioTrack: data.defaultAudioTrack,
      defaultSubtitle: data.defaultSubtitle,
      isDefaultAudioAvailable: data.isDefaultAudioAvailable,
      subtitleFallbackTriggered: data.subtitleFallbackTriggered,
      configuredAudioLanguage: data.configuredAudioLanguage,
      configuredSubtitleLanguage: data.configuredSubtitleLanguage,
      subtitleMode: data.subtitleMode,
    };
  } catch (err) {
    console.error('[fetchMediaTracks] Exception:', err);
    return { audioTracks: [], subtitleTracks: [], qualities: [] };
  }
}
