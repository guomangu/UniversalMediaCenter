import crypto from 'node:crypto';
const MAX_QUEUED_COMMANDS = 100;
class CastDeviceRegistry {
    devices = new Map();
    commandQueues = new Map();
    DEVICE_TTL_MS = 35_000;
    MAX_DEVICES = 500;
    register(device) {
        // Purge les appareils expirés avant d'enregistrer, puis borne la taille du registre.
        this.listActive();
        if (!this.devices.has(device.id) && this.devices.size >= this.MAX_DEVICES) {
            const oldestId = this.devices.keys().next().value;
            if (oldestId !== undefined) {
                this.devices.delete(oldestId);
                this.commandQueues.delete(oldestId);
            }
        }
        const fullDevice = { ...device, lastSeenAt: Date.now() };
        this.devices.set(device.id, fullDevice);
        if (!this.commandQueues.has(device.id)) {
            this.commandQueues.set(device.id, []);
        }
        return fullDevice;
    }
    updateHeartbeat(id, updates) {
        const existing = this.devices.get(id);
        if (!existing)
            return null;
        const updated = { ...existing, ...updates, lastSeenAt: Date.now() };
        this.devices.set(id, updated);
        return updated;
    }
    listActive() {
        const now = Date.now();
        const active = [];
        for (const [id, dev] of this.devices.entries()) {
            if (now - dev.lastSeenAt <= this.DEVICE_TTL_MS) {
                active.push(dev);
            }
            else {
                this.devices.delete(id);
                this.commandQueues.delete(id);
            }
        }
        return active;
    }
    getDevice(id) {
        return this.devices.get(id);
    }
    queueCommand(cmd) {
        const fullCmd = {
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
    popCommands(deviceId) {
        const queue = this.commandQueues.get(deviceId) || [];
        this.commandQueues.set(deviceId, []);
        return queue;
    }
}
export const castRegistry = new CastDeviceRegistry();
