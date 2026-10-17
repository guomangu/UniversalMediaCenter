import { db } from '../db/connection.js';
import { mediaNodes, watchProgress } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
// Map nodeId -> Map userId -> WatcherInfo
const activeWatchersMap = new Map();
// Map userId -> UserLocationInfo
const userLocationMap = new Map();
// Map topicSlug -> Map userId -> VoiceCallParticipant
const voiceCallRooms = new Map();
// Map topicSlug -> AudioChunk[]
const voiceCallAudioChunks = new Map();
const PING_TIMEOUT_MS = 25000; // 25s avant expiration de la présence
export function recordActivePlayback(nodeId, parentId, userId, displayName, mediaTitle, isPlaying = true, positionSeconds = 0) {
    const now = Date.now();
    let watchers = activeWatchersMap.get(nodeId);
    if (!watchers) {
        watchers = new Map();
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
export function removeActivePlayback(nodeId, userId) {
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
export function recordUserPagePresence(userId, arg2, arg3, arg4, arg5) {
    const now = Date.now();
    let title = arg2;
    let path = arg3;
    let mediaId = arg4;
    if (arg5 !== undefined || (arg4 && arg4.startsWith("/"))) {
        // 5 arguments: userId, displayName, pageTitle, pagePath, mediaId
        title = arg3;
        path = arg4;
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
export function getActiveMediaCounts() {
    const now = Date.now();
    const counts = {};
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
                }
                else {
                    counts[parentKey].count += watchers.size;
                }
            }
        }
        else {
            activeWatchersMap.delete(nodeId);
        }
    }
    return counts;
}
export async function getUserLastLocation(userId) {
    const now = Date.now();
    // 1. Vérifier si l'utilisateur est ACTIVEMENT en train de visionner un média en temps réel
    for (const [nodeId, watchers] of activeWatchersMap.entries()) {
        const w = watchers.get(userId);
        if (w && w.isPlaying && now - w.lastPing < PING_TIMEOUT_MS) {
            const elapsedSec = w.isPlaying ? Math.min(30, Math.max(0, Math.floor((now - w.lastPing) / 1000))) : 0;
            const liveInfo = {
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
            const info = {
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
    }
    catch (err) {
        console.error('Error fetching user last location:', err);
    }
    return null;
}
// --- GESTION DES APPELS VOCAUX EN DIRECT (VOICE CALL ROOMS) ---
export function joinVoiceCall(topicSlug, userId, displayName, isMuted = false) {
    const slug = topicSlug.toLowerCase().trim();
    let room = voiceCallRooms.get(slug);
    if (!room) {
        room = new Map();
        voiceCallRooms.set(slug, room);
    }
    room.set(userId, {
        userId,
        displayName,
        isMuted,
        lastPing: Date.now(),
    });
}
export function leaveVoiceCall(topicSlug, userId) {
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
export function pingVoiceCall(topicSlug, userId, isMuted) {
    const slug = topicSlug.toLowerCase().trim();
    const room = voiceCallRooms.get(slug);
    if (!room)
        return [];
    const now = Date.now();
    const part = room.get(userId);
    if (part) {
        part.lastPing = now;
        if (typeof isMuted === 'boolean')
            part.isMuted = isMuted;
    }
    // Nettoyer participants inactifs depuis 15s
    for (const [uid, p] of room.entries()) {
        if (now - p.lastPing > 15000) {
            room.delete(uid);
        }
    }
    return Array.from(room.values());
}
export function getVoiceCallParticipants(topicSlug) {
    const slug = topicSlug.toLowerCase().trim();
    const room = voiceCallRooms.get(slug);
    if (!room)
        return [];
    const now = Date.now();
    for (const [uid, p] of room.entries()) {
        if (now - p.lastPing > 15000) {
            room.delete(uid);
        }
    }
    return Array.from(room.values());
}
export function pushVoiceAudioChunk(topicSlug, senderId, senderName, audioBase64, mimeType = 'audio/webm') {
    const slug = topicSlug.toLowerCase().trim();
    let chunks = voiceCallAudioChunks.get(slug);
    if (!chunks) {
        chunks = [];
        voiceCallAudioChunks.set(slug, chunks);
    }
    const now = Date.now();
    const chunk = {
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
export function getVoiceAudioChunks(topicSlug, sinceTimestamp, excludeUserId) {
    const slug = topicSlug.toLowerCase().trim();
    const chunks = voiceCallAudioChunks.get(slug) || [];
    return chunks.filter((c) => c.timestamp > sinceTimestamp && (!excludeUserId || c.senderId !== excludeUserId));
}
export const pushAudioChunk = pushVoiceAudioChunk;
export const pullAudioChunks = getVoiceAudioChunks;
