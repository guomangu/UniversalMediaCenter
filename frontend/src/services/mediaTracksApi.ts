import { getApiBaseUrl } from './apiConfig';

export interface MediaTracksData {
  audioTracks: { index: number; language: string; label: string; codec: string }[];
  subtitleTracks: { index: number; language: string; label: string; fileName?: string }[];
  qualities: { label: string; value: string }[];
}

export async function fetchMediaTracks(id: string): Promise<MediaTracksData> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/media/${id}/tracks`);
    if (!res.ok) return { audioTracks: [], subtitleTracks: [], qualities: [] };
    return await res.json();
  } catch {
    return { audioTracks: [], subtitleTracks: [], qualities: [] };
  }
}
