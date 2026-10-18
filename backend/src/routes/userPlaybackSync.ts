import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { watchProgress } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import type { UserSession } from '../middleware/access.js';
import { userDeviceRegistry } from '../devices/userDeviceRegistry.js';
import type { DevicePlaybackState } from '../devices/userDeviceRegistry.js';

export interface AccountPlaybackState {
  userId: string;
  deviceId: string;
  leaderDeviceId: string; // Appareil maître pilotant la lecture de ce groupe
  syncGroupId: string; // 'default', 'standalone', ou identifiant personnalisé
  mediaId: string;
  mediaTitle: string;
  posterUrl?: string;
  streamUrl?: string;
  isLive?: boolean;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  activeAudio: string;
  activeSubtitle: string;
  volume: number;
  isMuted: boolean;
  isCastActive?: boolean;
  castTargetId?: string;
  updatedAt: number;
}

const groupPlaybackMap = new Map<string, AccountPlaybackState>(); // key: `${userId}:${syncGroupId}`
const accountPlaybackMap = new Map<string, AccountPlaybackState>(); // key: userId (fallback rétro-compatible)
const lastDbSaveMap = new Map<string, number>();

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
  const user = (c as any).get('user') as UserSession;
  if (!user?.id) return c.json({ error: 'Non authentifié' }, 401);

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
  const groupPlayback = userDeviceRegistry.getGroupPlayback(user.id, syncGroupId);
  if (groupPlayback) {
    const leaderDeviceId = groupPlayback.deviceId;
    const reconstructed: AccountPlaybackState = {
      ...groupPlayback,
      userId: user.id,
      syncGroupId,
      deviceId: leaderDeviceId,
      leaderDeviceId,
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
playbackSyncRouter.post('/sync', async (c) => {
  const user = (c as any).get('user') as UserSession;
  if (!user?.id) return c.json({ error: 'Non authentifié' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const headerDeviceId = c.req.header('x-device-id');
  const {
    deviceId: bodyDeviceId,
    syncGroupId: bodySyncGroup,
    mediaId,
    mediaTitle,
    posterUrl,
    streamUrl,
    isLive,
    positionSeconds,
    durationSeconds,
    isPlaying,
    activeAudio,
    activeSubtitle,
    volume,
    isMuted,
    isCastActive,
    castTargetId,
    isAction, // true si l'utilisateur a initié une action explicite (play, pause, seek, openMedia)
  } = body;

  const deviceId = String(bodyDeviceId || headerDeviceId || '').trim();
  const syncGroupId = String(bodySyncGroup || 'default').trim();

  if (!deviceId || !mediaId) {
    return c.json({ error: 'deviceId et mediaId sont requis' }, 400);
  }

  const now = Date.now();
  const groupKey = `${user.id}:${syncGroupId}`;
  const existingGroupState = groupPlaybackMap.get(groupKey);

  // Détermination du leader de lecture :
  // Si action explicite ou pas de leader actif depuis > 10s : cet appareil devient leader
  let leaderDeviceId = deviceId;
  if (existingGroupState && !isAction) {
    const isOldLeaderAlive = now - existingGroupState.updatedAt < 10_000;
    if (isOldLeaderAlive && existingGroupState.leaderDeviceId) {
      leaderDeviceId = existingGroupState.leaderDeviceId;
    }
  }

  const state: AccountPlaybackState = {
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
    isPlaying: Boolean(isPlaying),
    activeAudio: String(activeAudio || 'auto'),
    activeSubtitle: String(activeSubtitle || 'off'),
    volume: typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1,
    isMuted: Boolean(isMuted),
    isCastActive: Boolean(isCastActive),
    castTargetId: castTargetId ? String(castTargetId) : undefined,
    updatedAt: now,
  };

  // Mise à jour de la table de groupe et globale si non-standalone
  if (syncGroupId !== 'standalone') {
    groupPlaybackMap.set(groupKey, state);
    accountPlaybackMap.set(user.id, state);
  }

  // Mise à jour de l'état de lecture dans le registre d'appareils
  const devPlayback: DevicePlaybackState = {
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
    db.execute(sql`
      INSERT INTO watch_progress (user_id, node_id, position_seconds, duration_seconds, is_completed, updated_at)
      VALUES (${user.id}, ${mediaId}, ${Math.floor(state.positionSeconds)}, ${Math.floor(state.durationSeconds)}, ${state.positionSeconds >= state.durationSeconds * 0.9}, NOW())
      ON CONFLICT (user_id, node_id)
      DO UPDATE SET
        position_seconds = EXCLUDED.position_seconds,
        duration_seconds = EXCLUDED.duration_seconds,
        is_completed = EXCLUDED.is_completed,
        updated_at = NOW()
    `).catch(() => {});
  }

  return c.json({ success: true, playback: state });
});

// Arrêter la session de lecture du compte ou d'un appareil
playbackSyncRouter.post('/stop', async (c) => {
  const user = (c as any).get('user') as UserSession;
  if (!user?.id) return c.json({ error: 'Non authentifié' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const headerDeviceId = c.req.header('x-device-id');
  const deviceId = String(body.deviceId || headerDeviceId || '').trim();
  const syncGroupId = String(body.syncGroupId || 'default').trim();
  const groupKey = `${user.id}:${syncGroupId}`;

  const existingGroup = groupPlaybackMap.get(groupKey);
  const isLeaderStopping = !deviceId || (existingGroup && (existingGroup.leaderDeviceId === deviceId || existingGroup.deviceId === deviceId));

  if (isLeaderStopping) {
    groupPlaybackMap.delete(groupKey);
    accountPlaybackMap.delete(user.id);
    userDeviceRegistry.clearGroupPlayback(user.id, syncGroupId);
  } else if (deviceId) {
    userDeviceRegistry.updatePlayback(user.id, deviceId, undefined);
  }

  return c.json({ success: true });
});

// Diffuser un média simultanément sur une liste d'appareils cibles (Multi-room / synchronisation flexible)
playbackSyncRouter.post('/broadcast', async (c) => {
  const user = (c as any).get('user') as UserSession;
  if (!user?.id) return c.json({ error: 'Non authentifié' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const {
    targetDeviceIds,
    syncGroupId = 'default',
    mediaId,
    title,
    streamUrl,
    posterUrl,
    positionSeconds = 0,
  } = body;

  if (!mediaId || !Array.isArray(targetDeviceIds) || targetDeviceIds.length === 0) {
    return c.json({ error: 'mediaId et targetDeviceIds[] sont requis' }, 400);
  }

  let sentCount = 0;
  for (const devId of targetDeviceIds) {
    const dev = userDeviceRegistry.getDevice(String(devId));
    if (dev && dev.userId === user.id) {
      // Définir le groupe de synchronisation pour lier les appareils ensemble
      userDeviceRegistry.setSyncGroup(user.id, dev.deviceId, syncGroupId);

      // Envoyer la commande de chargement du média
      userDeviceRegistry.queueCommand({
        targetDeviceId: dev.deviceId,
        userId: user.id,
        action: 'LOAD_MEDIA',
        payload: {
          mediaId,
          title,
          streamUrl,
          posterUrl,
          positionSeconds,
          syncGroupId,
        },
      });
      sentCount++;
    }
  }

  return c.json({
    success: true,
    sentCount,
    syncGroupId,
    message: `Diffusion lancée sur ${sentCount} appareil(s)`,
  });
});
