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
export function recordActivePlayback(nodeId, parentId, userId, displayName, mediaTitle, isPlaying = true) {
    const now = Date.now();
    let nodeWatchers = activeWatchersMap.get(nodeId);
    if (!nodeWatchers) {
        nodeWatchers = new Map();
        activeWatchersMap.set(nodeId, nodeWatchers);
    }
    nodeWatchers.set(userId, {
        userId,
        displayName,
        nodeId,
        parentId,
        mediaTitle,
        isPlaying,
        lastPing: now,
    });
    // Mettre à jour l'emplacement de l'utilisateur (dernière page connue)
    userLocationMap.set(userId, {
        userId,
        mediaId: nodeId,
        title: mediaTitle,
        path: `/player/${nodeId}`,
        isLive: isPlaying,
        updatedAt: now,
    });
}
export function recordUserPagePresence(userId, displayName, pageTitle, pagePath, mediaId) {
    const now = Date.now();
    userLocationMap.set(userId, {
        userId,
        mediaId,
        title: pageTitle,
        path: pagePath,
        isLive: false,
        updatedAt: now,
    });
}
export function removeActivePlayback(nodeId, userId) {
    const nodeWatchers = activeWatchersMap.get(nodeId);
    if (nodeWatchers) {
        nodeWatchers.delete(userId);
        if (nodeWatchers.size === 0)
            activeWatchersMap.delete(nodeId);
    }
}
export function getActiveMediaCounts() {
    const now = Date.now();
    const result = {};
    const parentCounts = {};
    // Nettoyer les timeouts et agréger
    for (const [nodeId, watchers] of activeWatchersMap.entries()) {
        for (const [uid, info] of watchers.entries()) {
            if (now - info.lastPing > PING_TIMEOUT_MS) {
                watchers.delete(uid);
            }
        }
        if (watchers.size === 0) {
            activeWatchersMap.delete(nodeId);
            continue;
        }
        // Le média lui-même a des spectateurs
        const activeList = Array.from(watchers.values());
        const count = activeList.length;
        if (count > 0) {
            const first = activeList[0];
            result[nodeId] = {
                count,
                title: first.mediaTitle,
                isPlaying: activeList.some((w) => w.isPlaying),
            };
            // Si le média a un parent (ex: épisode d'une série), agréger sur le parent !
            if (first.parentId) {
                if (!parentCounts[first.parentId]) {
                    parentCounts[first.parentId] = { count: 0 };
                }
                parentCounts[first.parentId].count += count;
            }
        }
    }
    // Ajouter les parents qui ont des spectateurs sur leurs épisodes
    for (const [parentId, info] of Object.entries(parentCounts)) {
        if (info.count > 0) {
            if (!result[parentId]) {
                result[parentId] = {
                    count: info.count,
                    title: info.title || 'Série en cours',
                    isPlaying: true,
                };
            }
            else {
                result[parentId].count = Math.max(result[parentId].count, info.count);
            }
        }
    }
    return result;
}
export async function getUserLastLocation(userId) {
    const now = Date.now();
    const cached = userLocationMap.get(userId);
    if (cached && now - cached.updatedAt < PING_TIMEOUT_MS) {
        return { ...cached, isLive: true };
    }
    if (cached) {
        return { ...cached, isLive: false };
    }
    // Fallback vers la base de données (dernier watch_progress)
    try {
        const lastWatch = await db
            .select({
            nodeId: watchProgress.nodeId,
            title: mediaNodes.title,
            updatedAt: watchProgress.updatedAt,
        })
            .from(watchProgress)
            .innerJoin(mediaNodes, eq(watchProgress.nodeId, mediaNodes.id))
            .where(eq(watchProgress.userId, userId))
            .orderBy(desc(watchProgress.updatedAt))
            .limit(1);
        if (lastWatch.length > 0) {
            const item = lastWatch[0];
            const isRecent = item.updatedAt ? now - new Date(item.updatedAt).getTime() < 60000 : false;
            const loc = {
                userId,
                mediaId: item.nodeId,
                title: item.title,
                path: `/player/${item.nodeId}`,
                isLive: isRecent,
                updatedAt: item.updatedAt ? new Date(item.updatedAt).getTime() : now,
            };
            userLocationMap.set(userId, loc);
            return loc;
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
    const chunk = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId,
        senderName,
        audioBase64,
        mimeType,
        timestamp: Date.now(),
    };
    chunks.push(chunk);
    // Garder au maximum les 30 derniers chunks récents (dernières ~30 secondes)
    if (chunks.length > 30) {
        chunks.splice(0, chunks.length - 30);
    }
    return chunk;
}
export function getVoiceAudioChunks(topicSlug, sinceTimestamp, excludeUserId) {
    const slug = topicSlug.toLowerCase().trim();
    const chunks = voiceCallAudioChunks.get(slug) || [];
    return chunks.filter((c) => c.timestamp > sinceTimestamp && (!excludeUserId || c.senderId !== excludeUserId));
}
