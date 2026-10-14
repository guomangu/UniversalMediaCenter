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
