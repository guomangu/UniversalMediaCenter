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
        const created = existing?.createdAt || now;
        const rawName = data.name || existing?.name || "";
        const isGeneric = !rawName || rawName === "Appareil Connecté" || rawName === "Navigateur Web" || rawName === "Linux" || rawName === "Windows" || rawName === "Mac";
        const computedName = isGeneric && (data.userAgent || existing?.userAgent) ? parseRealDeviceName(data.userAgent || existing?.userAgent, rawName) : (rawName || "Écran Connecté");
        const finalName = existing?.customName || computedName;
        const finalSyncGroup = data.syncGroupId || existing?.syncGroupId || 'default';
        const updated = {
            deviceId,
            userId,
            name: finalName,
            customName: existing?.customName,
            deviceType: data.deviceType || existing?.deviceType || 'BROWSER',
            clientInfo: data.clientInfo || existing?.clientInfo,
            userAgent: data.userAgent || existing?.userAgent,
            ip: data.ip || existing?.ip,
            lastSeenAt: now,
            createdAt: created,
            currentRoute: data.currentRoute || existing?.currentRoute || '/',
            pageTitle: data.pageTitle || existing?.pageTitle || 'Accueil',
            syncGroupId: finalSyncGroup,
            currentPlayback: data.currentPlayback !== undefined ? data.currentPlayback : existing?.currentPlayback,
            isRevoked: false,
        };
        this.devices.set(deviceId, updated);
        return { device: updated, isRevoked: false };
    }
    getDevice(deviceId) {
        return this.devices.get(deviceId);
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
        // Tri : En ligne d'abord, puis par dernière activité décroissante
        result.sort((a, b) => {
            if (a.isOnline !== b.isOnline)
                return a.isOnline ? -1 : 1;
            return b.lastSeenAt - a.lastSeenAt;
        });
        return result;
    }
    renameDevice(userId, deviceId, newName) {
        const dev = this.devices.get(deviceId);
        if (!dev || dev.userId !== userId)
            return false;
        dev.name = newName.trim();
        dev.customName = newName.trim();
        this.devices.set(deviceId, dev);
        return true;
    }
    setSyncGroup(userId, deviceId, syncGroupId) {
        const dev = this.devices.get(deviceId);
        if (!dev || dev.userId !== userId)
            return false;
        dev.syncGroupId = syncGroupId.trim();
        this.devices.set(deviceId, dev);
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
            if (dev.userId === userId && deviceId !== currentDeviceId) {
                this.revokeDevice(userId, deviceId);
                count++;
            }
        }
        return count;
    }
    isRevoked(userId, deviceId) {
        const userRevocations = this.revokedDevices.get(userId);
        return Boolean(userRevocations?.has(deviceId));
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
        let dev = this.devices.get(deviceId);
        if (!dev) {
            // Auto-enregistrement au vol de l'appareil s'il n'a pas encore fait de battement de cœur
            dev = {
                deviceId,
                userId,
                name: 'Appareil Connecté',
                deviceType: 'BROWSER',
                lastSeenAt: Date.now(),
                createdAt: Date.now(),
                currentRoute: '/',
                syncGroupId: syncGroupId || 'default',
                currentPlayback: playback,
                isRevoked: false,
            };
            this.devices.set(deviceId, dev);
        }
        else if (dev.userId === userId) {
            dev.currentPlayback = playback;
            if (syncGroupId)
                dev.syncGroupId = syncGroupId;
            dev.lastSeenAt = Date.now();
        }
    }
    /**
     * Nettoie l'état de lecture de tous les appareils d'un groupe donné
     */
    clearGroupPlayback(userId, syncGroupId) {
        for (const dev of this.devices.values()) {
            if (dev.userId === userId && dev.syncGroupId === syncGroupId) {
                dev.currentPlayback = undefined;
            }
        }
    }
    /**
     * Trouve l'état de lecture le plus frais d'un groupe de synchronisation donné pour un utilisateur,
     * incluant le deviceId de l'appareil émetteur.
     */
    getGroupPlayback(userId, syncGroupId, excludeDeviceId) {
        if (!syncGroupId || syncGroupId === 'standalone')
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
                if (excludeDeviceId && dev.deviceId === excludeDeviceId) {
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
}
export const userDeviceRegistry = new UserDeviceRegistry();
