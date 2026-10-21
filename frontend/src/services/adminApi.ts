import { invalidateCacheByPrefix } from './pwaDataCache';
import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

export interface PhysicalFolderItem {
  path: string;
  name: string;
  rootPath: string;
  parentPath: string | null;
  relativePath: string;
  mediaCount: number;
  directMediaCount: number;
  subfolderCount: number;
  depth: number;
  existsOnDisk: boolean;
}

export interface PhysicalFoldersResponse {
  success: boolean;
  roots: string[];
  folders: PhysicalFolderItem[];
  totalFolders: number;
  totalMedia: number;
  error?: string;
}

export async function fetchPublicConfig(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/config`);
    return await res.json();
  } catch {
    return { siteName: 'UMS', invitationOnly: false, allowOnTheFlyCreation: true };
  }
}

export async function fetchSiteConfig(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/config`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.params || null;
  } catch {
    return null;
  }
}

export async function updateSiteConfig(partial: any): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/config`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(partial),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchAdminUsers(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/users`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.users || [];
  } catch {
    return [];
  }
}

export async function createAdminUser(payload: {
  displayName: string;
  email?: string;
  password?: string;
  profileRole?: string;
  isAdmin?: boolean;
  canDownload?: boolean;
  canTranscode?: boolean;
  canWatchIptv?: boolean;
  maxCsaAgeLimit?: number | null;
  allowedTags?: string[];
  blockedTags?: string[];
  allowedFolders?: string[];
  blockedFolders?: string[];
}): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAdminUser(id: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAdminUser(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchProfileTypes(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/profile-types`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.profileTypes || [];
  } catch {
    return [];
  }
}

export async function createProfileType(payload: any): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/profile-types`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProfileType(id: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/profile-types/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProfileType(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/profile-types/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchPhysicalFolders(): Promise<PhysicalFoldersResponse> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/folders`, { headers: getAuthHeaders() });
    return await res.json();
  } catch (err: any) {
    return { success: false, roots: [], folders: [], totalFolders: 0, totalMedia: 0, error: err.message };
  }
}

export async function fetchAdminRails(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/rails`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.rails || [];
  } catch {
    return [];
  }
}

export async function reorderAdminRails(railOrders: { id: string; sortOrder: number }[]): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/rails/reorder`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ railOrders }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAdminRail(id: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/rails/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchAdminTags(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/tags`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.tags || [];
  } catch {
    return [];
  }
}

export async function updateAdminTag(id: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/tags/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchIptvSources(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/iptv/sources`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.sources || [];
  } catch {
    return [];
  }
}

export async function createIptvSource(payload: { name: string; m3uUrl: string; epgXmltvUrl?: string }): Promise<any> {
  invalidateCacheByPrefix('iptv_');
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/iptv/sources`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function syncIptvSource(id: string): Promise<any> {
  invalidateCacheByPrefix('iptv_');
  invalidateCacheByPrefix('epg_');
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/iptv/sources/${id}/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Synchronise les guides XMLTV de toutes les sources IPTV actives. */
export async function syncAllEpg(): Promise<any> {
  invalidateCacheByPrefix('iptv_');
  invalidateCacheByPrefix('epg_');
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/iptv/sync-epg`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateIptvSource(id: string, updates: any): Promise<any> {
  invalidateCacheByPrefix('iptv_');
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/iptv/sources/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteIptvSource(id: string): Promise<any> {
  invalidateCacheByPrefix('iptv_');
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/iptv/sources/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface ScanStatusResponse {
  isScanning: boolean;
  phase?: string;
  phaseName?: string;
  totalDiscovered: number;
  processedCount: number;
  nfoCount: number;
  standaloneCount: number;
  enrichedCount?: number;
  currentFile?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  report?: any;
  stats?: {
    totalNodes: number;
    collectionsCount?: number;
    moviesCount: number;
    showsCount: number;
    episodesCount: number;
    extrasCount: number;
    verifiedCount: number;
    toVerifyCount: number;
  };
  chaosRoots?: string[];
}

export async function fetchScanStatus(): Promise<ScanStatusResponse | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/scan/status`, { headers: getAuthHeaders() });
    return await res.json();
  } catch {
    return null;
  }
}

export async function triggerUniversalScan(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/scan/trigger`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rebuildMediaHierarchy(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/scan/rebuild-hierarchy`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchMediaToVerify(): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/media/to-verify`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function validateMedia(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/media/${id}/validate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function matchMedia(id: string, payload: { title?: string }): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/media/${id}/match`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface AdminInvitation {
  id: string;
  token: string;
  inviteUrl: string;
  messageText: string;
  fullInvitationMessage?: string;
  displayName: string;
  email: string;
  password?: string;
  profileRole: string;
  clicksCount: number;
  lastUsedAt?: string | null;
  createdAt: string;
  previewTitle?: string;
  previewDescription?: string;
}

export async function fetchAdminInvitations(): Promise<AdminInvitation[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/invitations`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.invitations || [];
  } catch {
    return [];
  }
}

export async function createAdminInvitation(payload: {
  displayName?: string;
  recipientName?: string;
  email?: string;
  recipientEmail?: string;
  password?: string;
  customPassword?: string;
  profileRole?: string;
  customToken?: string;
  customSlug?: string;
}): Promise<{ success: boolean; invitation?: AdminInvitation; error?: string }> {
  try {
    const normalizedPayload = {
      displayName: payload.displayName || payload.recipientName || '',
      email: payload.email || payload.recipientEmail || undefined,
      password: payload.password || payload.customPassword || undefined,
      profileRole: payload.profileRole || 'MEMBRE',
      customToken: payload.customToken || payload.customSlug || undefined,
    };
    const res = await fetch(`${getApiBaseUrl()}/api/admin/invitations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(normalizedPayload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau' };
  }
}

export async function deleteAdminInvitation(id: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/invitations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
