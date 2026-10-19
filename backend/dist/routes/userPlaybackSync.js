import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { watchProgress } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import { userDeviceRegistry } from '../devices/userDeviceRegistry.js';
import { canUserAccessMediaNodeId } from '../auth/mediaAccess.js';
const groupPlaybackMap = new Map(); // key: `${userId}:${syncGroupId}`
const accountPlaybackMap = new Map(); // key: userId (fallback rétro-compatible)
const lastDbSaveMap = new Map();
// Cache court du contrôle d'accès : la synchronisation peut émettre plusieurs
// requêtes par seconde et on ne veut pas interroger la base à chaque battement.
const mediaAccessCache = new Map();
const MEDIA_ACCESS_CACHE_TTL_MS = 60_000;
async function canSyncMedia(user, mediaId) {
    if (user.isAdmin)
        return true;
    const key = `${user.id}:${mediaId}`;
    const now = Date.now();
    const cached = mediaAccessCache.get(key);
    if (cached && cached.expiresAt > now)
        return cached.allowed;
    const allowed = await canUserAccessMediaNodeId(user, mediaId);
    if (mediaAccessCache.size > 2000) {
        const oldest = mediaAccessCache.keys().next().value;
        if (oldest !== undefined)
            mediaAccessCache.delete(oldest);
    }
    mediaAccessCache.set(key, { allowed, expiresAt: now + MEDIA_ACCESS_CACHE_TTL_MS });
    return allowed;
}
function isMatchingDevice(idA, idB) {
    if (!idA || !idB)
        return false;
    if (idA === idB)
        return true;
    const baseA = idA.split('_tab_')[0];
    const baseB = idB.split('_tab_')[0];
    return baseA === baseB;
}
// Nettoyage périodique des sessions de lecture inactives (> 60 secondes sans battement de cœur)
const syncCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, state] of groupPlaybackMap.entries()) {
        if (now - state.updatedAt > 60_000) {
            groupPlaybackMap.delete(key);
        }
    }
    for (const [userId, state] of accountPlaybackMap.entries()) {
        if (now - state.updatedAt > 60_000) {
            accountPlaybackMap.delete(userId);
        }
    }
}, 15_000);
if (typeof syncCleanupTimer.unref === 'function') {
    syncCleanupTimer.unref();
}
export const playbackSyncRouter = new Hono();
playbackSyncRouter.use('*', requireAuth);
// Récupérer l'état de lecture synchronisé actif du compte pour un groupe donné
playbackSyncRouter.get('/sync', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const deviceId = c.req.header('x-device-id') || c.req.query('deviceId') || '';
    const syncGroupId = c.req.query('syncGroupId') || 'default';
    // Si l'appareil est en mode solo / indépendant, il ne synchronise pas avec les autres
    if (syncGroupId === 'standalone') {
        return c.json({ playback: null, mode: 'standalone' });
    }
    const now = Date.now();
    const groupKey = `${user.id}:${syncGroupId}`;
    // 1. Recherche prioritaire dans la table de groupe par userId:syncGroupId
    const groupState = groupPlaybackMap.get(groupKey);
    if (groupState && now - groupState.updatedAt <= 60_000) {
        return c.json({
            playback: groupState,
            currentDeviceId: deviceId,
        });
    }
    // 2. Recherche dans le registre d'appareils pour ce groupe spécifique
    // Ne renvoyer une lecture reconstruite QUE si elle provient d'un AUTRE appareil réel !
    const groupPlayback = userDeviceRegistry.getGroupPlayback(user.id, syncGroupId, deviceId);
    if (groupPlayback && !isMatchingDevice(groupPlayback.deviceId, deviceId)) {
        const leaderDeviceId = groupPlayback.deviceId;
        const reconstructed = {
            ...groupPlayback,
            userId: user.id,
            syncGroupId,
            deviceId: leaderDeviceId,
            leaderDeviceId,
            orderSeq: 1,
            originDeviceId: leaderDeviceId,
            actionTimestamp: now,
        };
        groupPlaybackMap.set(groupKey, reconstructed);
        return c.json({
            playback: reconstructed,
            currentDeviceId: deviceId,
        });
    }
    // 3. Fallback sur la map globale du compte si groupe 'default'
    const active = accountPlaybackMap.get(user.id) || null;
    if (active && (!active.syncGroupId || active.syncGroupId === syncGroupId) && now - active.updatedAt <= 60_000) {
        return c.json({ playback: active, currentDeviceId: deviceId });
    }
    return c.json({ playback: null, currentDeviceId: deviceId });
});
// Publier / mettre à jour l'état de lecture synchronisé du compte
// Architecture : Appareil 1 ou 2 interagissant avec le player → Serveur → Appareils 1 et 2 synchronisés recevant le nouvel ordre
playbackSyncRouter.post('/sync', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const headerDeviceId = c.req.header('x-device-id');
    const { deviceId: bodyDeviceId, syncGroupId: bodySyncGroup, mediaId, mediaTitle, posterUrl, streamUrl, isLive, positionSeconds, durationSeconds, isPlaying, activeAudio, activeSubtitle, volume, isMuted, isCastActive, castTargetId, isAction, // true si l'utilisateur a touché le player (play, pause, seek, audio, sub, openMedia)
    actionType, } = body;
    const deviceId = String(bodyDeviceId || headerDeviceId || '').trim();
    const syncGroupId = String(bodySyncGroup || 'default').trim();
    if (!deviceId || !mediaId) {
        return c.json({ error: 'deviceId et mediaId sont requis' }, 400);
    }
    // Ne jamais diffuser ni enregistrer la progression d'un média auquel
    // l'utilisateur n'a pas droit (contrôle parental / PBAC).
    if (!(await canSyncMedia(user, String(mediaId)))) {
        return c.json({ error: 'Accès non autorisé à ce média', code: 'FORBIDDEN' }, 403);
    }
    const now = Date.now();
    const groupKey = `${user.id}:${syncGroupId}`;
    const existingGroupState = groupPlaybackMap.get(groupKey);
    // Règle d'or : "Le dernier appareil touchant le player a raison (c'est la dernière modif qui compte)"
    // Si isAction est vrai (l'utilisateur a interagi avec les contrôles), cet appareil émet un nouvel ordre officiel
    let leaderDeviceId = deviceId;
    let isSenderAuthoritative = false;
    let nextOrderSeq = existingGroupState?.orderSeq || 1;
    let actionTimestamp = existingGroupState?.actionTimestamp || now;
    const isSameLeader = existingGroupState && isMatchingDevice(deviceId, existingGroupState.leaderDeviceId);
    if (isAction) {
        leaderDeviceId = deviceId;
        isSenderAuthoritative = true;
        nextOrderSeq = (existingGroupState?.orderSeq || 0) + 1;
        actionTimestamp = now;
    }
    else if (existingGroupState && existingGroupState.mediaId !== String(mediaId)) {
        // Si le groupe avait un média différent, le sender qui joue un nouveau média devient leader
        leaderDeviceId = deviceId;
        isSenderAuthoritative = true;
        nextOrderSeq = (existingGroupState?.orderSeq || 0) + 1;
        actionTimestamp = now;
    }
    else if (existingGroupState) {
        // Si un ordre explicite vient d'avoir lieu (< 3.5s), un simple battement passif suiveur ne peut pas le renverser
        const isRecentActionLock = now - (existingGroupState.actionTimestamp || 0) < 3500;
        const isOldLeaderAlive = now - existingGroupState.updatedAt < 15_000;
        if (isRecentActionLock) {
            leaderDeviceId = existingGroupState.leaderDeviceId;
            isSenderAuthoritative = Boolean(isSameLeader);
        }
        else if (isOldLeaderAlive && existingGroupState.leaderDeviceId) {
            leaderDeviceId = existingGroupState.leaderDeviceId;
            isSenderAuthoritative = Boolean(isSameLeader);
        }
        else {
            // Ancien leader inactif ou expiré : ce terminal devient le nouveau leader
            leaderDeviceId = deviceId;
            isSenderAuthoritative = true;
        }
    }
    else {
        isSenderAuthoritative = true;
    }
    // Si l'émetteur n'est pas le leader et n'a pas effectué d'action explicite (simple battement suiveur en retard),
    // on NE DOIT PAS écraser l'état du leader souverain avec ce battement passif !
    if (!isSenderAuthoritative && existingGroupState && syncGroupId !== 'standalone') {
        // Mise à jour de l'état individuel de ce terminal suiveur dans le registre sans corrompre le groupe
        const followerPlayback = {
            mediaId: String(mediaId),
            mediaTitle: String(mediaTitle || 'Média'),
            posterUrl: posterUrl ? String(posterUrl) : undefined,
            streamUrl: streamUrl ? String(streamUrl) : undefined,
            isLive: Boolean(isLive),
            positionSeconds: Number(positionSeconds) || 0,
            durationSeconds: Number(durationSeconds) || 0,
            isPlaying: Boolean(existingGroupState.isPlaying), // Forcer l'alignement sur l'ordre officiel
            activeAudio: String(activeAudio || 'auto'),
            activeSubtitle: String(activeSubtitle || 'off'),
            volume: typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1,
            isMuted: Boolean(isMuted),
            updatedAt: now,
        };
        userDeviceRegistry.updatePlayback(user.id, deviceId, followerPlayback, syncGroupId);
        // Retourner l'état officiel à ce terminal pour qu'il s'aligne immédiatement
        return c.json({ success: true, playback: existingGroupState, isFollower: true });
    }
    // Déterminer isPlaying officiel pour le leader souverain
    const officialPlaying = Boolean(isPlaying);
    const state = {
        userId: user.id,
        deviceId: String(deviceId),
        leaderDeviceId,
        syncGroupId,
        mediaId: String(mediaId),
        mediaTitle: String(mediaTitle || 'Média'),
        posterUrl: posterUrl ? String(posterUrl) : undefined,
        streamUrl: streamUrl ? String(streamUrl) : undefined,
        isLive: Boolean(isLive),
        positionSeconds: Number(positionSeconds) || 0,
        durationSeconds: Number(durationSeconds) || 0,
        isPlaying: officialPlaying,
        activeAudio: String(activeAudio || 'auto'),
        activeSubtitle: String(activeSubtitle || 'off'),
        volume: typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1,
        isMuted: Boolean(isMuted),
        isCastActive: Boolean(isCastActive),
        castTargetId: castTargetId ? String(castTargetId) : undefined,
        orderSeq: nextOrderSeq,
        originDeviceId: isAction ? deviceId : (existingGroupState?.originDeviceId || deviceId),
        actionType: isAction ? (actionType || 'INTERACTION') : (existingGroupState?.actionType || 'PROGRESS'),
        actionTimestamp,
        updatedAt: now,
    };
    // Mise à jour de la table de groupe et globale si non-standalone
    if (syncGroupId !== 'standalone') {
        groupPlaybackMap.set(groupKey, state);
        accountPlaybackMap.set(user.id, state);
    }
    // Mise à jour de l'état de lecture dans le registre d'appareils
    const devPlayback = {
        mediaId: state.mediaId,
        mediaTitle: state.mediaTitle,
        posterUrl: state.posterUrl,
        streamUrl: state.streamUrl,
        isLive: state.isLive,
        positionSeconds: state.positionSeconds,
        durationSeconds: state.durationSeconds,
        isPlaying: state.isPlaying,
        activeAudio: state.activeAudio,
        activeSubtitle: state.activeSubtitle,
        volume: state.volume,
        isMuted: state.isMuted,
        updatedAt: now,
    };
    userDeviceRegistry.updatePlayback(user.id, deviceId, devPlayback, syncGroupId);
    // Sauvegarde décorrélée en base de données pour la reprise de lecture
    const lastSave = lastDbSaveMap.get(`${user.id}:${mediaId}`) || 0;
    if (!state.isLive && state.positionSeconds > 0 && now - lastSave > 4000) {
        lastDbSaveMap.set(`${user.id}:${mediaId}`, now);
        db.execute(sql `
      INSERT INTO watch_progress (user_id, node_id, position_seconds, duration_seconds, is_completed, updated_at)
      VALUES (${user.id}, ${mediaId}, ${Math.floor(state.positionSeconds)}, ${Math.floor(state.durationSeconds)}, ${state.positionSeconds >= state.durationSeconds * 0.9}, NOW())
      ON CONFLICT (user_id, node_id)
      DO UPDATE SET
        position_seconds = EXCLUDED.position_seconds,
        duration_seconds = EXCLUDED.duration_seconds,
        is_completed = EXCLUDED.is_completed,
        updated_at = NOW()
    `).catch(() => { });
    }
    return c.json({ success: true, playback: state });
});
// Arrêter / fermer la lecture synchronisée du compte
playbackSyncRouter.post('/stop', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const headerDeviceId = c.req.header('x-device-id');
    const deviceId = String(body.deviceId || headerDeviceId || '').trim();
    const syncGroupId = String(body.syncGroupId || 'default').trim();
    const groupKey = `${user.id}:${syncGroupId}`;
    const existing = groupPlaybackMap.get(groupKey);
    // Seul le leader ou un terminal du même groupe peut clore la session
    if (existing) {
        groupPlaybackMap.delete(groupKey);
    }
    accountPlaybackMap.delete(user.id);
    userDeviceRegistry.clearGroupPlayback(user.id, syncGroupId);
    return c.json({ success: true });
});
