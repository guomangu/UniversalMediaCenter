import { Hono } from 'hono';
import { castRegistry } from '../cast/deviceRegistry.js';

export const castRouter = new Hono();

castRouter.get('/devices', (c) => {
  const devices = castRegistry.listActive();
  return c.json({ devices });
});

castRouter.post('/register', async (c) => {
  const body = await c.req.json();
  const { id, name, deviceType } = body;
  if (!id || !name) {
    return c.json({ error: 'id and name are required' }, 400);
  }
  const device = castRegistry.register({
    id,
    name,
    deviceType: deviceType || 'BROWSER',
    positionSeconds: body.positionSeconds || 0,
    durationSeconds: body.durationSeconds || 0,
    isPlaying: body.isPlaying || false,
    volume: body.volume ?? 1,
  });
  return c.json({ success: true, device });
});

castRouter.post('/heartbeat', async (c) => {
  const body = await c.req.json();
  const { id, ...updates } = body;
  if (!id) return c.json({ error: 'id is required' }, 400);
  const updated = castRegistry.updateHeartbeat(id, updates);
  if (!updated) return c.json({ error: 'Device not found or expired' }, 404);
  return c.json({ success: true, device: updated });
});

castRouter.post('/command', async (c) => {
  const body = await c.req.json();
  const { targetDeviceId, action, payload } = body;
  if (!targetDeviceId || !action) {
    return c.json({ error: 'targetDeviceId and action are required' }, 400);
  }
  const cmd = castRegistry.queueCommand({ targetDeviceId, action, payload });
  return c.json({ success: true, command: cmd });
});

castRouter.get('/poll/:deviceId', (c) => {
  const deviceId = c.req.param('deviceId');
  const commands = castRegistry.popCommands(deviceId);
  castRegistry.updateHeartbeat(deviceId, {});
  return c.json({ commands });
});
