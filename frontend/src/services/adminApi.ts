const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'X-User-Id': 'f551d728-1a26-414b-9fc5-84da681b1164',
};

export async function fetchPublicConfig(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/config`);
    return await res.json();
  } catch {
    return { siteName: 'UMS', invitationOnly: false, allowOnTheFlyCreation: true };
  }
}

export async function registerOnTheFly(payload: {
  displayName: string;
  email?: string;
  pin?: string;
  invitationCode?: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register-on-the-fly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function fetchSiteConfig(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/config`, { headers: ADMIN_HEADERS });
    const data = await res.json();
    return data.params || null;
  } catch {
    return null;
  }
}

export async function updateSiteConfig(partial: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/config`, {
      method: 'PUT',
      headers: ADMIN_HEADERS,
      body: JSON.stringify(partial),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchAdminUsers(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`, { headers: ADMIN_HEADERS });
    const data = await res.json();
    return data.users || [];
  } catch {
    return [];
  }
}

export async function updateAdminUser(id: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: ADMIN_HEADERS,
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAdminUser(id: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: ADMIN_HEADERS,
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
