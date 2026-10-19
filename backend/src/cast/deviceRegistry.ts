import crypto from 'node:crypto';
import type { CastDevice, CastCommand } from './types.js';

const MAX_QUEUED_COMMANDS = 100;

class CastDeviceRegistry {
  private devices = new Map<string, CastDevice>();
  private commandQueues = new Map<string, CastCommand[]>();
  private readonly DEVICE_TTL_MS = 35_000;
  private readonly MAX_DEVICES = 500;

  public register(device: Omit<CastDevice, 'lastSeenAt'>): CastDevice {
    // Purge les appareils expirés avant d'enregistrer, puis borne la taille du registre.
    this.listActive();
    if (!this.devices.has(device.id) && this.devices.size >= this.MAX_DEVICES) {
      const oldestId = this.devices.keys().next().value;
      if (oldestId !== undefined) {
        this.devices.delete(oldestId);
        this.commandQueues.delete(oldestId);
      }
    }

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
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const queue = this.commandQueues.get(cmd.targetDeviceId) || [];
    queue.push(fullCmd);
    // Éviter qu'un appareil qui ne poll plus accumule indéfiniment des commandes.
    if (queue.length > MAX_QUEUED_COMMANDS) {
      queue.splice(0, queue.length - MAX_QUEUED_COMMANDS);
    }
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
