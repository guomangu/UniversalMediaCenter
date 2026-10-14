import type { CastDevice, CastCommand } from './types.js';

class CastDeviceRegistry {
  private devices = new Map<string, CastDevice>();
  private commandQueues = new Map<string, CastCommand[]>();
  private readonly DEVICE_TTL_MS = 35_000;

  public register(device: Omit<CastDevice, 'lastSeenAt'>): CastDevice {
    const fullDevice: CastDevice = { ...device, lastSeenAt: Date.now() };
    this.devices.set(device.id, fullDevice);
    if (!this.commandQueues.has(device.id)) {
      this.commandQueues.set(device.id, []);
    }
    return fullDevice;
  }

  public updateHeartbeat(id: string, updates: Partial<CastDevice>): CastDevice | null {
    const existing = this.devices.get(id);
    if (!existing) return null;
    const updated: CastDevice = { ...existing, ...updates, lastSeenAt: Date.now() };
    this.devices.set(id, updated);
    return updated;
  }

  public listActive(): CastDevice[] {
    const now = Date.now();
    const active: CastDevice[] = [];
    for (const [id, dev] of this.devices.entries()) {
      if (now - dev.lastSeenAt <= this.DEVICE_TTL_MS) {
        active.push(dev);
      } else {
        this.devices.delete(id);
        this.commandQueues.delete(id);
      }
    }
    return active;
  }

  public getDevice(id: string): CastDevice | undefined {
    return this.devices.get(id);
  }

  public queueCommand(cmd: Omit<CastCommand, 'id' | 'createdAt'>): CastCommand {
    const fullCmd: CastCommand = {
      ...cmd,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: Date.now(),
    };
    const queue = this.commandQueues.get(cmd.targetDeviceId) || [];
    queue.push(fullCmd);
    this.commandQueues.set(cmd.targetDeviceId, queue);
    return fullCmd;
  }

  public popCommands(deviceId: string): CastCommand[] {
    const queue = this.commandQueues.get(deviceId) || [];
    this.commandQueues.set(deviceId, []);
    return queue;
  }
}

export const castRegistry = new CastDeviceRegistry();
