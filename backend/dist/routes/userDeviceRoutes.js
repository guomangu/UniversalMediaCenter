import { Hono } from 'hono';
import { requireAuth } from '../middleware/access.js';
import { userDeviceRegistry } from '../devices/userDeviceRegistry.js';
export const userDeviceRouter = new Hono();
userDeviceRouter.use('*', requireAuth);
// Lister tous les appareils connectés au compte de l'utilisateur
userDeviceRouter.get('/devices', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const currentDeviceId = c.req.header('x-device-id') || '';
    const devices = userDeviceRegistry.listUserDevices(user.id);
    const decorated = devices.map((d) => ({
        ...d,
        isCurrentDevice: Boolean(currentDeviceId && d.deviceId === currentDeviceId),
    }));
    return c.json({
        success: true,
        devices: decorated,
        currentDeviceId,
    });
});
// Enregistrement / Heartbeat d'un appareil avec récupération directe des commandes en attente
userDeviceRouter.post('/devices/heartbeat', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const headerDeviceId = c.req.header('x-device-id');
    const deviceId = String(body.deviceId || headerDeviceId || '').trim();
    if (!deviceId) {
        return c.json({ error: 'deviceId requis' }, 400);
    }
    // Vérifier si l'appareil a été révoqué
    if (userDeviceRegistry.isRevoked(user.id, deviceId)) {
        return c.json({
            error: 'DEVICE_REVOKED',
            message: 'Cet appareil a été déconnecté à distance de votre compte.',
        }, 401);
    }
    // Détection User-Agent & IP
    const userAgent = c.req.header('user-agent') || '';
    const ip = c.req.header('x-forwarded-for') || c.req.header('remote-addr') || '';
    const { device, isRevoked } = userDeviceRegistry.registerOrHeartbeat({
        deviceId,
        userId: user.id,
        name: body.name,
        deviceType: body.deviceType,
        clientInfo: body.clientInfo,
        userAgent,
        ip,
        currentRoute: body.currentRoute,
        pageTitle: body.pageTitle,
        syncGroupId: body.syncGroupId,
        currentPlayback: body.currentPlayback,
    });
    if (isRevoked) {
        return c.json({
            error: 'DEVICE_REVOKED',
            message: 'Cet appareil a été déconnecté à distance de votre compte.',
        }, 401);
    }
    // Dépiler les commandes en attente pour cet appareil
    const pendingCommands = userDeviceRegistry.popCommands(deviceId);
    return c.json({
        success: true,
        device,
        commands: pendingCommands,
    });
});
// Renommer un appareil
userDeviceRouter.post('/devices/rename', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const { deviceId, name } = await c.req.json().catch(() => ({}));
    if (!deviceId || !name || !String(name).trim()) {
        return c.json({ error: 'deviceId et name sont requis' }, 400);
    }
    const success = userDeviceRegistry.renameDevice(user.id, String(deviceId), String(name));
    return c.json({ success });
});
// Changer le groupe de synchronisation d'un appareil (ex: 'default', 'standalone', 'salon', etc.)
userDeviceRouter.post('/devices/sync-group', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const { deviceId, syncGroupId } = await c.req.json().catch(() => ({}));
    if (!deviceId || !syncGroupId) {
        return c.json({ error: 'deviceId et syncGroupId sont requis' }, 400);
    }
    const success = userDeviceRegistry.setSyncGroup(user.id, String(deviceId), String(syncGroupId));
    return c.json({ success });
});
// Déconnecter à distance un appareil spécifique
userDeviceRouter.post('/devices/:deviceId/disconnect', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const deviceId = c.req.param('deviceId');
    if (!deviceId)
        return c.json({ error: 'deviceId requis' }, 400);
    userDeviceRegistry.revokeDevice(user.id, deviceId);
    return c.json({ success: true, message: 'Appareil déconnecté avec succès' });
});
// Déconnecter tous les autres appareils connectés au compte
userDeviceRouter.post('/devices/disconnect-all-others', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const currentDeviceId = c.req.header('x-device-id') || '';
    const count = userDeviceRegistry.revokeAllOtherDevices(user.id, currentDeviceId);
    return c.json({
        success: true,
        revokedCount: count,
        message: `${count} autre(s) appareil(s) déconnecté(s)`,
    });
});
// Envoyer une commande à distance à un appareil ciblé
userDeviceRouter.post('/devices/command', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const { targetDeviceId, action, payload } = body;
    if (!targetDeviceId || !action) {
        return c.json({ error: 'targetDeviceId et action sont requis' }, 400);
    }
    // Vérifier que l'appareil cible appartient bien à l'utilisateur
    const targetDev = userDeviceRegistry.getDevice(String(targetDeviceId));
    if (!targetDev || targetDev.userId !== user.id) {
        return c.json({ error: 'Appareil introuvable ou non associé à ce compte' }, 404);
    }
    const cmd = userDeviceRegistry.queueCommand({
        targetDeviceId: String(targetDeviceId),
        userId: user.id,
        action: action,
        payload,
    });
    return c.json({ success: true, command: cmd });
});
// Polling des commandes d'un appareil
userDeviceRouter.get('/devices/poll/:deviceId', async (c) => {
    const user = c.get('user');
    if (!user?.id)
        return c.json({ error: 'Non authentifié' }, 401);
    const deviceId = c.req.param('deviceId');
    if (userDeviceRegistry.isRevoked(user.id, deviceId)) {
        return c.json({
            error: 'DEVICE_REVOKED',
            message: 'Cet appareil a été déconnecté à distance.',
        }, 401);
    }
    const commands = userDeviceRegistry.popCommands(deviceId);
    return c.json({ commands });
});
