import { db } from '../db/connection.js';
import { mediaNodes, watchProgress } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

export interface WatcherInfo {
  userId: string;
  displayName: string;
  nodeId: string;
  parentId: string | null;
  mediaTitle: string;
  isPlaying: boolean;
  positionSeconds?: number;
  lastPing: number;
}

export interface UserLocationInfo {
  userId: string;
  mediaId?: string;
  title: string;
  path: string;
  isLive: boolean;
  positionSeconds?: number;
  updatedAt: number;
}

export interface AudioChunk {
  id: string;
  senderId: string;
  senderName: string;
  audioBase64: string;
  mimeType: string;
  timestamp: number;
}

export interface VoiceCallParticipant {
  userId: string;
  displayName: string;
  isMuted: boolean;
  lastPing: number;
}

// Map nodeId -> Map userId -> WatcherInfo
const activeWatchersMap = new Map<string, Map<string, WatcherInfo>>();
// Map userId -> UserLocationInfo
const userLocationMap = new Map<string, UserLocationInfo>();
// Map topicSlug -> Map userId -> VoiceCallParticipant
const voiceCallRooms = new Map<string, Map<string, VoiceCallParticipant>>();
// Map topicSlug -> AudioChunk[]
const voiceCallAudioChunks = new Map<string, AudioChunk[]>();

const PING_TIMEOUT_MS = 25000; // 25s avant expiration de la présence

export function recordActivePlayback(
  nodeId: string,
  parentId: string | null,
  userId: string,
  displayName: string,
  mediaTitle: string,
  isPlaying = true,
  positionSeconds = 0
) {
  const now = Date.now();

  let watchers = activeWatchersMap.get(nodeId);
  if (!watchers) {
    watchers = new Map<string, WatcherInfo>();
    activeWatchersMap.set(nodeId, watchers);
  }

  watchers.set(userId, {
    userId,
    displayName,
    nodeId,
    parentId,
    mediaTitle,
    isPlaying,
    positionSeconds,
    lastPing: now,
  });

  // Mettre à jour la dernière page connue de l'utilisateur
  userLocationMap.set(userId, {
    userId,
    mediaId: nodeId,
    title: mediaTitle,
    path: `/player/${nodeId}`,
    isLive: isPlaying,
    positionSeconds,
    updatedAt: now,
  });
}

export function removeActivePlayback(nodeId: string, userId: string) {
  const watchers = activeWatchersMap.get(nodeId);
  if (watchers) {
    watchers.delete(userId);
    if (watchers.size === 0) {
      activeWatchersMap.delete(nodeId);
    }
  }

  const loc = userLocationMap.get(userId);
  if (loc && loc.mediaId === nodeId) {
    loc.isLive = false;
    loc.updatedAt = Date.now();
  }
}

export function recordUserPagePresence(
  userId: string,
  arg2: string,
  arg3: string,
  arg4?: string,
  arg5?: string
) {
  const now = Date.now();
  let title = arg2;
  let path = arg3;
  let mediaId = arg4;

  if (arg5 !== undefined || (arg4 && arg4.startsWith("/"))) {
    // 5 arguments: userId, displayName, pageTitle, pagePath, mediaId
    title = arg3;
    path = arg4!;
    mediaId = arg5;
  }

  userLocationMap.set(userId, {
    userId,
    mediaId,
    title,
    path,
    isLive: false,
    updatedAt: now,
  });
}

export function getActiveMediaCounts(): Record<string, { count: number; title: string }> {
  const now = Date.now();
  const counts: Record<string, { count: number; title: string }> = {};

  for (const [nodeId, watchers] of activeWatchersMap.entries()) {
    // Nettoyer les pings expirés
    for (const [uid, info] of watchers.entries()) {
      if (now - info.lastPing > PING_TIMEOUT_MS || !info.isPlaying) {
        watchers.delete(uid);
      }
    }

    if (watchers.size > 0) {
      const first = Array.from(watchers.values())[0];
      counts[nodeId] = {
        count: watchers.size,
        title: first.mediaTitle,
      };

      // Si le média a un parentId (ex: épisode -> série), propager le comptage au parent
      if (first.parentId) {
        const parentKey = first.parentId;
        if (!counts[parentKey]) {
          counts[parentKey] = {
            count: watchers.size,
            title: first.mediaTitle,
          };
        } else {
          counts[parentKey].count += watchers.size;
        }
      }
    } else {
      activeWatchersMap.delete(nodeId);
    }
  }

  return counts;
}

export async function getUserLastLocation(userId: string): Promise<UserLocationInfo | null> {
  const now = Date.now();

  // 1. Vérifier si l'utilisateur est ACTIVEMENT en train de visionner un média en temps réel
  for (const [nodeId, watchers] of activeWatchersMap.entries()) {
    const w = watchers.get(userId);
    if (w && w.isPlaying && now - w.lastPing < PING_TIMEOUT_MS) {
      const elapsedSec = w.isPlaying ? Math.min(30, Math.max(0, Math.floor((now - w.lastPing) / 1000))) : 0;
      const liveInfo: UserLocationInfo = {
        userId,
        mediaId: nodeId,
        title: w.mediaTitle,
        path: `/player/${nodeId}`,
        isLive: true,
        positionSeconds: (w.positionSeconds || 0) + elapsedSec,
        updatedAt: now,
      };
      userLocationMap.set(userId, liveInfo);
      return liveInfo;
    }
  }

  // 2. Si pas en direct, vérifier la dernière page mémorisée (avec isLive = false)
  const cached = userLocationMap.get(userId);
  if (cached && now - cached.updatedAt < 5 * 60 * 1000) {
    return {
      ...cached,
      isLive: false,
    };
  }

  // 3. Fallback en base de données : dernière progression connue (toujours isLive: false)
  try {
    const lastProgress = await db
      .select({
        nodeId: watchProgress.nodeId,
        title: mediaNodes.title,
        positionSeconds: watchProgress.positionSeconds,
        updatedAt: watchProgress.updatedAt,
      })
      .from(watchProgress)
      .innerJoin(mediaNodes, eq(watchProgress.nodeId, mediaNodes.id))
      .where(eq(watchProgress.userId, userId))
      .orderBy(desc(watchProgress.updatedAt))
      .limit(1);

    if (lastProgress.length > 0) {
      const p = lastProgress[0];
      const info: UserLocationInfo = {
        userId,
        mediaId: p.nodeId,
        title: p.title,
        path: `/player/${p.nodeId}`,
        isLive: false,
        positionSeconds: p.positionSeconds || 0,
        updatedAt: p.updatedAt.getTime(),
      };
      userLocationMap.set(userId, info);
      return info;
    }
  } catch (err) {
    console.error('Error fetching user last location:', err);
  }

  return null;
}

// --- GESTION DES APPELS VOCAUX EN DIRECT (VOICE CALL ROOMS) ---

export function joinVoiceCall(topicSlug: string, userId: string, displayName: string, isMuted = false) {
  const slug = topicSlug.toLowerCase().trim();
  let room = voiceCallRooms.get(slug);
  if (!room) {
    // Borne le nombre de salons vocaux simultanés pour éviter une croissance
    // mémoire illimitée via des slugs arbitraires.
    if (voiceCallRooms.size >= 500) return;
    room = new Map<string, VoiceCallParticipant>();
    voiceCallRooms.set(slug, room);
  }

  room.set(userId, {
    userId,
    displayName,
    isMuted,
    lastPing: Date.now(),
  });
}

export function leaveVoiceCall(topicSlug: string, userId: string) {
  const slug = topicSlug.toLowerCase().trim();
  const room = voiceCallRooms.get(slug);
  if (room) {
    room.delete(userId);
    if (room.size === 0) {
      voiceCallRooms.delete(slug);
      voiceCallAudioChunks.delete(slug);
    }
  }
}

export function pingVoiceCall(topicSlug: string, userId: string, isMuted?: boolean): VoiceCallParticipant[] {
  const slug = topicSlug.toLowerCase().trim();
  const room = voiceCallRooms.get(slug);
  if (!room) return [];

  const now = Date.now();
  const part = room.get(userId);
  if (part) {
    part.lastPing = now;
    if (typeof isMuted === 'boolean') part.isMuted = isMuted;
  }

  // Nettoyer participants inactifs depuis 15s
  for (const [uid, p] of room.entries()) {
    if (now - p.lastPing > 15000) {
      room.delete(uid);
    }
  }

  return Array.from(room.values());
}

export function getVoiceCallParticipants(topicSlug: string): VoiceCallParticipant[] {
  const slug = topicSlug.toLowerCase().trim();
  const room = voiceCallRooms.get(slug);
  if (!room) return [];

  const now = Date.now();
  for (const [uid, p] of room.entries()) {
    if (now - p.lastPing > 15000) {
      room.delete(uid);
    }
  }

  if (room.size === 0) {
    voiceCallRooms.delete(slug);
    voiceCallAudioChunks.delete(slug);
    return [];
  }

  return Array.from(room.values());
}

export function pushVoiceAudioChunk(
  topicSlug: string,
  senderId: string,
  senderName: string,
  audioBase64: string,
  mimeType = 'audio/webm'
) {
  const slug = topicSlug.toLowerCase().trim();
  let chunks = voiceCallAudioChunks.get(slug);
  if (!chunks) {
    chunks = [];
    voiceCallAudioChunks.set(slug, chunks);
  }

  const now = Date.now();
  const chunk: AudioChunk = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    senderId,
    senderName,
    audioBase64,
    mimeType,
    timestamp: now,
  };

  chunks.push(chunk);

  const cutoff = now - 90000;
  const filtered = chunks.filter((c) => c.timestamp > cutoff);
  if (filtered.length > 60) {
    filtered.splice(0, filtered.length - 60);
  }
  voiceCallAudioChunks.set(slug, filtered);

  return chunk;
}

export function getVoiceAudioChunks(topicSlug: string, sinceTimestamp: number, excludeUserId?: string): AudioChunk[] {
  const slug = topicSlug.toLowerCase().trim();
  const chunks = voiceCallAudioChunks.get(slug) || [];
  return chunks.filter((c) => c.timestamp > sinceTimestamp && (!excludeUserId || c.senderId !== excludeUserId));
}

export const pushAudioChunk = pushVoiceAudioChunk;
export const pullAudioChunks = getVoiceAudioChunks;
