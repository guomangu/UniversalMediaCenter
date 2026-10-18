import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { watchProgress } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
const accountPlaybackMap = new Map();
const lastDbSaveMap = new Map();
// Nettoyage périodique des sessions de lecture inactives (> 60 secondes sans heartbeat)
setInterval(() => {
    const now = Date.now();
    for (const [userId, state] of accountPlaybackMap.entries()) {
        if (now - state.updatedAt > 60_000) {
            accountPlaybackMap.delete(userId);
        }
    }
}, 15_000);
export const playbackSyncRouter = new Hono();
playbackSyncRouter.use('*', requireAuth);
// Récupérer l'état de lecture synchronisé actif du compte
playbackSyncRouter.get('/sync', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const active = accountPlaybackMap.get(user.id) || null;
    return c.json({ playback: active });
});
// Publier / mettre à jour l'état de lecture synchronisé du compte
playbackSyncRouter.post('/sync', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const { deviceId, mediaId, mediaTitle, posterUrl, streamUrl, isLive, positionSeconds, durationSeconds, isPlaying, activeAudio, activeSubtitle, volume, isMuted, isCastActive, castTargetId, } = body;
    if (!deviceId || !mediaId) {
        return c.json({ error: 'deviceId et mediaId sont requis' }, 400);
    }
    const now = Date.now();
    const state = {
        userId: user.id,
        deviceId: String(deviceId),
        mediaId: String(mediaId),
        mediaTitle: String(mediaTitle || 'Média'),
        posterUrl: posterUrl ? String(posterUrl) : undefined,
        streamUrl: streamUrl ? String(streamUrl) : undefined,
        isLive: Boolean(isLive),
        positionSeconds: Number(positionSeconds) || 0,
        durationSeconds: Number(durationSeconds) || 0,
        isPlaying: Boolean(isPlaying),
        activeAudio: String(activeAudio || 'auto'),
        activeSubtitle: String(activeSubtitle || 'off'),
        volume: typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1,
        isMuted: Boolean(isMuted),
        isCastActive: Boolean(isCastActive),
        castTargetId: castTargetId ? String(castTargetId) : undefined,
        updatedAt: now,
    };
    accountPlaybackMap.set(user.id, state);
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
// Arrêter la session de lecture du compte
playbackSyncRouter.post('/stop', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const existing = accountPlaybackMap.get(user.id);
    if (existing) {
        accountPlaybackMap.delete(user.id);
    }
    return c.json({ success: true });
});
