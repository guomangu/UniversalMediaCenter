function parseRealDeviceName(userAgent, fallback) {
    const ua = userAgent || "";
    let browser = "Navigateur";
    if (/Edg\//i.test(ua))
        browser = "Microsoft Edge";
    else if (/OPR\/|Opera/i.test(ua))
        browser = "Opera";
    else if (/Chrome\//i.test(ua))
        browser = "Google Chrome";
    else if (/Firefox\//i.test(ua))
        browser = "Mozilla Firefox";
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua))
        browser = "Apple Safari";
    if (/Tizen/i.test(ua))
        return "Samsung Smart TV (Tizen)";
    if (/webOS/i.test(ua))
        return "LG Smart TV (webOS)";
    if (/Android/i.test(ua)) {
        if (/TV|SmartTV/i.test(ua))
            return "Android TV";
        const m = ua.match(/Android [^;]+;\s*([^;)]+)\)/i);
        const model = m && m[1] ? m[1].replace(/Build\/.*/i, "").trim() : "";
        return model ? `${model} (${browser})` : `${browser} (Android)`;
    }
    if (/iPhone/i.test(ua))
        return `iPhone (${browser})`;
    if (/iPad/i.test(ua))
        return `iPad (${browser})`;
    if (/SmartTV/i.test(ua))
        return "Smart TV";
    if (/Windows/i.test(ua))
        return `${browser} (Windows)`;
    if (/Macintosh|Mac OS/i.test(ua))
        return `${browser} (macOS)`;
    if (/Linux/i.test(ua))
        return `${browser} (Linux)`;
    return fallback && fallback !== "Appareil Connecté" && fallback !== "Navigateur Web" ? fallback : `${browser} Web`;
}
class UserDeviceRegistry {
    devices = new Map(); // key: deviceId
    revokedDevices = new Map(); // key: userId -> Set of revoked deviceIds
    commandQueues = new Map(); // key: deviceId
    DEVICE_TTL_MS = 60_000; // 60 secondes d'inactivité avant marquage hors-ligne
    constructor() {
        // Nettoyage périodique des queues de commandes et des appareils inactifs depuis plus de 24h
        const timer = setInterval(() => {
            const now = Date.now();
            for (const [deviceId, dev] of this.devices.entries()) {
                if (now - dev.lastSeenAt > 24 * 3600 * 1000) {
                    this.devices.delete(deviceId);
                    this.commandQueues.delete(deviceId);
                }
            }
        }, 60_000);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }
    isMatchingDevice(idA, idB) {
        if (!idA || !idB)
            return false;
        if (idA === idB)
            return true;
        const baseA = idA.split('_tab_')[0];
        const baseB = idB.split('_tab_')[0];
        return baseA === baseB;
    }
    registerOrHeartbeat(data) {
        const { deviceId, userId } = data;
        const now = Date.now();
        // Vérifier si l'appareil a été révoqué
        if (this.isRevoked(userId, deviceId)) {
            return {
                device: {
                    deviceId,
                    userId,
                    name: data.name || 'Appareil révoqué',
                    deviceType: data.deviceType || 'BROWSER',
                    lastSeenAt: now,
                    createdAt: now,
                    currentRoute: data.currentRoute || '/',
                    syncGroupId: 'standalone',
                    isRevoked: true,
                },
                isRevoked: true,
            };
        }
        const existing = this.devices.get(deviceId);
        const parsedName = parseRealDeviceName(data.userAgent, data.name || existing?.name);
        const updated = {
            deviceId,
            userId,
            name: parsedName,
            customName: existing?.customName,
            deviceType: data.deviceType || existing?.deviceType || 'BROWSER',
            clientInfo: data.clientInfo || existing?.clientInfo,
            userAgent: data.userAgent || existing?.userAgent,
            ip: data.ip || existing?.ip,
            lastSeenAt: now,
            createdAt: existing ? existing.createdAt : now,
            isOnline: true,
            currentRoute: data.currentRoute !== undefined ? data.currentRoute : existing?.currentRoute,
            pageTitle: data.pageTitle !== undefined ? data.pageTitle : existing?.pageTitle,
            syncGroupId: data.syncGroupId || existing?.syncGroupId || 'standalone',
            currentPlayback: data.currentPlayback !== undefined ? data.currentPlayback : existing?.currentPlayback,
            isRevoked: false,
        };
        this.devices.set(deviceId, updated);
        return { device: updated, isRevoked: false };
    }
    listUserDevices(userId) {
        const now = Date.now();
        const result = [];
        for (const dev of this.devices.values()) {
            if (dev.userId === userId && !this.isRevoked(userId, dev.deviceId)) {
                const isOnline = now - dev.lastSeenAt <= this.DEVICE_TTL_MS;
                result.push({ ...dev, isOnline });
            }
        }
        result.sort((a, b) => {
            if (a.isOnline !== b.isOnline)
                return a.isOnline ? -1 : 1;
            return b.lastSeenAt - a.lastSeenAt;
        });
        return result;
    }
    clearGroupPlayback(userId, syncGroupId) {
        for (const dev of this.devices.values()) {
            if (dev.userId === userId && dev.syncGroupId === syncGroupId) {
                dev.currentPlayback = undefined;
            }
        }
    }
    getGroupPlayback(userId, syncGroupId, excludeDeviceId) {
        if (!syncGroupId || syncGroupId === "standalone")
            return null;
        const now = Date.now();
        let bestPlayback = null;
        let bestDeviceId = null;
        let latestTime = 0;
        for (const dev of this.devices.values()) {
            if (dev.userId === userId &&
                dev.syncGroupId === syncGroupId &&
                dev.currentPlayback &&
                now - dev.lastSeenAt <= this.DEVICE_TTL_MS) {
                if (excludeDeviceId && this.isMatchingDevice(dev.deviceId, excludeDeviceId)) {
                    continue;
                }
                if (dev.currentPlayback.updatedAt > latestTime) {
                    latestTime = dev.currentPlayback.updatedAt;
                    bestPlayback = dev.currentPlayback;
                    bestDeviceId = dev.deviceId;
                }
            }
        }
        if (bestPlayback && bestDeviceId) {
            return {
                ...bestPlayback,
                deviceId: bestDeviceId,
            };
        }
        return null;
    }
    getDevicesForUser(userId) {
        const now = Date.now();
        const result = [];
        for (const dev of this.devices.values()) {
            if (dev.userId === userId && !this.isRevoked(userId, dev.deviceId)) {
                result.push({
                    ...dev,
                    isOnline: now - dev.lastSeenAt < this.DEVICE_TTL_MS,
                });
            }
        }
        return result.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    }
    getDevice(deviceId) {
        const dev = this.devices.get(deviceId);
        if (!dev)
            return null;
        const now = Date.now();
        return {
            ...dev,
            isOnline: now - dev.lastSeenAt < this.DEVICE_TTL_MS,
        };
    }
    renameDevice(userId, deviceId, customName) {
        const dev = this.devices.get(deviceId);
        if (!dev || dev.userId !== userId)
            return false;
        dev.name = customName.trim();
        dev.customName = customName.trim();
        this.devices.set(deviceId, dev);
        return true;
    }
    setSyncGroup(userId, deviceId, syncGroupId) {
        const dev = this.devices.get(deviceId);
        if (!dev || dev.userId !== userId)
            return false;
        dev.syncGroupId = syncGroupId.trim();
        this.devices.set(deviceId, dev);
        // Notifier immédiatement l'appareil cible en file de commandes
        this.queueCommand({
            targetDeviceId: deviceId,
            userId,
            action: 'SET_SYNC_GROUP',
            payload: { syncGroupId: syncGroupId.trim() },
        });
        return true;
    }
    revokeDevice(userId, deviceId) {
        let userRevocations = this.revokedDevices.get(userId);
        if (!userRevocations) {
            userRevocations = new Set();
            this.revokedDevices.set(userId, userRevocations);
        }
        userRevocations.add(deviceId);
        // Envoyer la commande de déconnexion immédiate à l'appareil
        this.queueCommand({
            targetDeviceId: deviceId,
            userId,
            action: 'REVOKE_SESSION',
            payload: { message: 'Votre compte a été déconnecté à distance sur cet appareil.' },
        });
        // Retirer de la liste active des appareils
        this.devices.delete(deviceId);
        return true;
    }
    revokeAllOtherDevices(userId, currentDeviceId) {
        let count = 0;
        for (const [deviceId, dev] of this.devices.entries()) {
            if (dev.userId === userId && !this.isMatchingDevice(deviceId, currentDeviceId)) {
                this.revokeDevice(userId, deviceId);
                count++;
            }
        }
        return count;
    }
    /** Recharge les révocations persistées au démarrage du serveur. */
    hydrateRevocations(rows) {
        for (const row of rows) {
            if (!row.userId || !row.deviceId)
                continue;
            let userRevocations = this.revokedDevices.get(row.userId);
            if (!userRevocations) {
                userRevocations = new Set();
                this.revokedDevices.set(row.userId, userRevocations);
            }
            userRevocations.add(row.deviceId);
        }
    }
    isRevoked(userId, deviceId) {
        const userRevocations = this.revokedDevices.get(userId);
        if (!userRevocations || userRevocations.size === 0)
            return false;
        if (userRevocations.has(deviceId))
            return true;
        const baseTarget = deviceId.split('_tab_')[0];
        for (const id of Array.from(userRevocations)) {
            if (id.split('_tab_')[0] === baseTarget)
                return true;
        }
        return false;
    }
    consumeRevocation(userId, deviceId) {
        this.unrevokeDevice(userId, deviceId);
    }
    unrevokeDevice(userId, deviceId) {
        // Sans identifiant d'appareil précis, on ne lève AUCUNE révocation :
        // sinon une simple requête de login sans X-Device-Id réautoriserait tous
        // les appareils précédemment déconnectés.
        if (!deviceId)
            return;
        const userRevocations = this.revokedDevices.get(userId);
        if (!userRevocations)
            return;
        const baseTarget = deviceId.split('_tab_')[0];
        for (const id of Array.from(userRevocations)) {
            if (id === deviceId || id.split('_tab_')[0] === baseTarget) {
                userRevocations.delete(id);
            }
        }
        if (userRevocations.size === 0) {
            this.revokedDevices.delete(userId);
        }
    }
    clearAllRevocations(userId) {
        if (userId) {
            this.revokedDevices.delete(userId);
        }
        else {
            this.revokedDevices.clear();
        }
    }
    queueCommand(cmd) {
        const fullCmd = {
            ...cmd,
            id: Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
            createdAt: Date.now(),
        };
        const queue = this.commandQueues.get(cmd.targetDeviceId) || [];
        queue.push(fullCmd);
        this.commandQueues.set(cmd.targetDeviceId, queue);
        return fullCmd;
    }
    popCommands(deviceId) {
        const queue = this.commandQueues.get(deviceId) || [];
        this.commandQueues.set(deviceId, []);
        return queue;
    }
    updatePlayback(userId, deviceId, playback, syncGroupId) {
        const dev = this.devices.get(deviceId);
        if (!dev || dev.userId !== userId)
            return false;
        if (playback !== undefined) {
            dev.currentPlayback = playback;
        }
        if (syncGroupId !== undefined) {
            dev.syncGroupId = syncGroupId.trim();
        }
        dev.lastSeenAt = Date.now();
        this.devices.set(deviceId, dev);
        return true;
    }
    getDevicesInSyncGroup(userId, syncGroupId) {
        const now = Date.now();
        const result = [];
        for (const dev of this.devices.values()) {
            if (dev.userId === userId &&
                dev.syncGroupId === syncGroupId &&
                syncGroupId !== 'standalone' &&
                !this.isRevoked(userId, dev.deviceId) &&
                now - dev.lastSeenAt < this.DEVICE_TTL_MS) {
                result.push(dev);
            }
        }
        return result;
    }
}
export const userDeviceRegistry = new UserDeviceRegistry();
