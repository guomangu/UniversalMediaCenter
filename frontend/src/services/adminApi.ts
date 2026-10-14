import { getApiBaseUrl } from './apiConfig';
import { getAuthHeaders } from './authStore';

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

export async function updateIptvSource(id: string, updates: any): Promise<any> {
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
  totalDiscovered: number;
  processedCount: number;
  nfoCount: number;
  standaloneCount: number;
  currentFile?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  stats?: {
    totalNodes: number;
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
