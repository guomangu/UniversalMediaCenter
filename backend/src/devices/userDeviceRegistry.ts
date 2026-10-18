export type UserDeviceType = 'BROWSER' | 'MOBILE' | 'TV' | 'CHROMECAST' | 'AIRPLAY' | 'DESKTOP';

export interface DevicePlaybackState {
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
  updatedAt: number;
}

export interface UserConnectedDevice {
  deviceId: string;
  userId: string;
  name: string;
  customName?: string;
  deviceType: UserDeviceType;
  clientInfo?: string;
  userAgent?: string;
  ip?: string;
  lastSeenAt: number;
  createdAt: number;
  currentRoute: string;
  pageTitle?: string;
  syncGroupId: string; // 'default', 'standalone', ou identifiant de groupe personnalisé
  currentPlayback?: DevicePlaybackState;
  isRevoked?: boolean;
}

export type DeviceAction =
  | 'LOAD_MEDIA'
  | 'NAVIGATE'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'STOP'
  | 'SET_VOLUME'
  | 'MUTE'
  | 'UNMUTE'
  | 'SET_AUDIO'
  | 'SET_SUBTITLE'
  | 'SET_SYNC_GROUP'
  | 'REVOKE_SESSION';

export interface UserDeviceCommand {
  id: string;
  targetDeviceId: string;
  userId: string;
  action: DeviceAction;
  payload?: any;
  createdAt: number;
}

class UserDeviceRegistry {
  private devices = new Map<string, UserConnectedDevice>(); // key: deviceId
  private revokedDevices = new Map<string, Set<string>>(); // key: userId -> Set of revoked deviceIds
  private commandQueues = new Map<string, UserDeviceCommand[]>(); // key: deviceId
  private readonly DEVICE_TTL_MS = 60_000; // 60 secondes d'inactivité avant marquage hors-ligne

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

  public registerOrHeartbeat(data: {
    deviceId: string;
    userId: string;
    name?: string;
    deviceType?: UserDeviceType;
    clientInfo?: string;
    userAgent?: string;
    ip?: string;
    currentRoute?: string;
    pageTitle?: string;
    syncGroupId?: string;
    currentPlayback?: DevicePlaybackState;
  }): { device: UserConnectedDevice; isRevoked: boolean } {
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
    const finalName = existing?.customName || data.name || existing?.name || 'Appareil Connecté';
    const finalSyncGroup = data.syncGroupId || existing?.syncGroupId || 'default';

    const updated: UserConnectedDevice = {
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

  public getDevice(deviceId: string): UserConnectedDevice | undefined {
    return this.devices.get(deviceId);
  }

  public listUserDevices(userId: string): Array<UserConnectedDevice & { isOnline: boolean }> {
    const now = Date.now();
    const result: Array<UserConnectedDevice & { isOnline: boolean }> = [];

    for (const dev of this.devices.values()) {
      if (dev.userId === userId && !this.isRevoked(userId, dev.deviceId)) {
        const isOnline = now - dev.lastSeenAt <= this.DEVICE_TTL_MS;
        result.push({ ...dev, isOnline });
      }
    }

    // Tri : En ligne d'abord, puis par dernière activité décroissante
    result.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return b.lastSeenAt - a.lastSeenAt;
    });

    return result;
  }

  public renameDevice(userId: string, deviceId: string, newName: string): boolean {
    const dev = this.devices.get(deviceId);
    if (!dev || dev.userId !== userId) return false;
    dev.name = newName.trim();
    dev.customName = newName.trim();
    this.devices.set(deviceId, dev);
    return true;
  }

  public setSyncGroup(userId: string, deviceId: string, syncGroupId: string): boolean {
    const dev = this.devices.get(deviceId);
    if (!dev || dev.userId !== userId) return false;
    dev.syncGroupId = syncGroupId.trim();
    this.devices.set(deviceId, dev);
    return true;
  }

  public revokeDevice(userId: string, deviceId: string): boolean {
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

  public revokeAllOtherDevices(userId: string, currentDeviceId: string): number {
    let count = 0;
    for (const [deviceId, dev] of this.devices.entries()) {
      if (dev.userId === userId && deviceId !== currentDeviceId) {
        this.revokeDevice(userId, deviceId);
        count++;
      }
    }
    return count;
  }

  public isRevoked(userId: string, deviceId: string): boolean {
    const userRevocations = this.revokedDevices.get(userId);
    return Boolean(userRevocations?.has(deviceId));
  }

  public queueCommand(cmd: Omit<UserDeviceCommand, 'id' | 'createdAt'>): UserDeviceCommand {
    const fullCmd: UserDeviceCommand = {
      ...cmd,
      id: Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
      createdAt: Date.now(),
    };
    const queue = this.commandQueues.get(cmd.targetDeviceId) || [];
    queue.push(fullCmd);
    this.commandQueues.set(cmd.targetDeviceId, queue);
    return fullCmd;
  }

  public popCommands(deviceId: string): UserDeviceCommand[] {
    const queue = this.commandQueues.get(deviceId) || [];
    this.commandQueues.set(deviceId, []);
    return queue;
  }

  public updatePlayback(
    userId: string,
    deviceId: string,
    playback?: DevicePlaybackState,
    syncGroupId?: string
  ): void {
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
    } else if (dev.userId === userId) {
      dev.currentPlayback = playback;
      if (syncGroupId) dev.syncGroupId = syncGroupId;
      dev.lastSeenAt = Date.now();
    }
  }

  /**
   * Nettoie l'état de lecture de tous les appareils d'un groupe donné
   */
  public clearGroupPlayback(userId: string, syncGroupId: string): void {
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
  public getGroupPlayback(
    userId: string,
    syncGroupId: string,
    excludeDeviceId?: string
  ): (DevicePlaybackState & { deviceId: string }) | null {
    if (!syncGroupId || syncGroupId === 'standalone') return null;
    const now = Date.now();
    let bestPlayback: DevicePlaybackState | null = null;
    let bestDeviceId: string | null = null;
    let latestTime = 0;

    for (const dev of this.devices.values()) {
      if (
        dev.userId === userId &&
        dev.syncGroupId === syncGroupId &&
        dev.currentPlayback &&
        now - dev.lastSeenAt <= this.DEVICE_TTL_MS
      ) {
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
