import { Hono } from 'hono';
import { castRegistry } from '../cast/deviceRegistry.js';
export const castRouter = new Hono();
// En-têtes CORS stricts et immédiats sur tous les endpoints de Cast
castRouter.use('*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', '*');
    if (c.req.method === 'OPTIONS')
        return c.text('OK', 200);
    return await next();
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
        id: b.id, name: b.name, deviceType: b.deviceType || 'BROWSER',
        currentMediaId: b.currentMediaId, mediaTitle: b.mediaTitle, posterUrl: b.posterUrl,
        positionSeconds: b.positionSeconds || 0, durationSeconds: b.durationSeconds || 0,
        isPlaying: b.isPlaying ?? false, volume: b.volume ?? 1, isMuted: b.isMuted ?? false,
        audioTrack: b.audioTrack, subtitleTrack: b.subtitleTrack,
    });
    return c.json({ success: true, device });
});
castRouter.post('/heartbeat', async (c) => {
    const { id, ...updates } = await c.req.json().catch(() => ({}));
    if (!id)
        return c.json({ error: 'id is required' }, 400);
    const updated = castRegistry.updateHeartbeat(id, updates);
    if (!updated)
        return c.json({ error: 'Device not found or expired' }, 404);
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
