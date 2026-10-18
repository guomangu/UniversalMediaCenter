import { Hono } from 'hono';
import { castRegistry } from '../cast/deviceRegistry.js';
import os from 'node:os';
export const castRouter = new Hono();
function getLanIp(clientHost) {
    // 1. Si une variable d'environnement explicite est fournie
    if (process.env.HOST_IP && process.env.HOST_IP.trim()) {
        return process.env.HOST_IP.trim();
    }
    if (process.env.SERVER_LAN_IP && process.env.SERVER_LAN_IP.trim()) {
        return process.env.SERVER_LAN_IP.trim();
    }
    // 2. Si le client s'est connecté via une IP ou un domaine joignable depuis son réseau
    if (clientHost) {
        const hostOnly = clientHost.split(':')[0].trim();
        if (hostOnly &&
            hostOnly !== 'localhost' &&
            hostOnly !== '127.0.0.1' &&
            hostOnly !== 'backend' &&
            !hostOnly.startsWith('10.89.') &&
            !hostOnly.startsWith('172.')) {
            return hostOnly;
        }
    }
    // 3. Inspection des interfaces réseau physiques
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
                return iface.address;
            }
        }
    }
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' &&
                !iface.internal &&
                !iface.address.startsWith('172.') &&
                !iface.address.startsWith('127.') &&
                !iface.address.startsWith('10.89.')) {
                return iface.address;
            }
        }
    }
    // 4. Fallback réseau local par défaut
    return '192.168.1.93';
}
// En-têtes CORS stricts et immédiats sur tous les endpoints de Cast
castRouter.use('*', async (c, next) => {
    const reqOrigin = c.req.header('origin') || '*';
    c.header('Access-Control-Allow-Origin', reqOrigin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin, Range, X-Requested-With, X-Device-Id, x-device-id');
    c.header('Access-Control-Allow-Credentials', 'true');
    if (c.req.method === 'OPTIONS')
        return c.body(null, 204);
    return await next();
});
castRouter.get('/info', (c) => {
    const host = c.req.header('x-forwarded-host') || c.req.header('host') || '';
    return c.json({
        lanIp: getLanIp(host),
        port: 3000,
        gatewayPort: 8080,
    });
});
castRouter.get('/devices', (c) => c.json({ devices: castRegistry.listActive() }));
castRouter.get('/device/:id', (c) => {
    const dev = castRegistry.getDevice(c.req.param('id'));
    if (!dev)
        return c.json({ error: 'Device not found' }, 404);
    return c.json({ device: dev });
});
castRouter.post('/register', async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (!b.id || !b.name)
        return c.json({ error: 'id and name required' }, 400);
    const device = castRegistry.register({
        id: b.id,
        name: b.name,
        deviceType: b.deviceType || 'BROWSER',
        currentMediaId: b.currentMediaId,
        mediaTitle: b.mediaTitle,
        posterUrl: b.posterUrl,
        positionSeconds: b.positionSeconds || 0,
        durationSeconds: b.durationSeconds || 0,
        isPlaying: b.isPlaying ?? false,
        volume: b.volume ?? 1,
        isMuted: b.isMuted ?? false,
        audioTrack: b.audioTrack,
        subtitleTrack: b.subtitleTrack,
    });
    return c.json({ success: true, device });
});
castRouter.post('/heartbeat', async (c) => {
    const { id, ...updates } = await c.req.json().catch(() => ({}));
    if (!id)
        return c.json({ error: 'id is required' }, 400);
    let updated = castRegistry.updateHeartbeat(id, updates);
    if (!updated) {
        updated = castRegistry.register({
            id,
            name: updates.name || 'Écran Récepteur',
            deviceType: updates.deviceType || 'BROWSER',
            ...updates,
        });
    }
    return c.json({ success: true, device: updated });
});
castRouter.post('/command', async (c) => {
    const { targetDeviceId, action, payload } = await c.req.json().catch(() => ({}));
    if (!targetDeviceId || !action)
        return c.json({ error: 'targetDeviceId and action required' }, 400);
    const cmd = castRegistry.queueCommand({ targetDeviceId, action, payload });
    return c.json({ success: true, command: cmd });
});
castRouter.get('/poll/:deviceId', (c) => {
    const deviceId = c.req.param('deviceId');
    const commands = castRegistry.popCommands(deviceId);
    castRegistry.updateHeartbeat(deviceId, {});
    return c.json({ commands });
});
