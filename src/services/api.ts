/**
 * ChatNova Live API Client for Render Backend
 */

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://chatnova-app-n20j.onrender.com/api';

// Token Storage Helpers
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('chatnova_jwt_token');
  } catch (e) {
    return null;
  }
};

export const setAuthToken = (token: string) => {
  try {
    if (token) localStorage.setItem('chatnova_jwt_token', token);
  } catch (e) {}
};

export const removeAuthToken = () => {
  try {
    localStorage.removeItem('chatnova_jwt_token');
  } catch (e) {}
};

// Real Live API Fetch Wrapper connected to Render Backend
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; isLiveBackend?: boolean }> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const result = await response.json();

    return {
      success: response.ok && (result.success !== false),
      data: result.data || result,
      message: result.message || 'Success',
      isLiveBackend: true,
    };
  } catch (error: any) {
    console.error('[API Fetch Error]:', error);
    return {
      success: false,
      message: error.message || 'Network connection error',
      isLiveBackend: false,
    };
  }
}

// 1. AUTHENTICATION APIS
export const authAPI = {
  register: async (payload: { customId: string; displayName: string; password: string }) => {
    const res = await apiFetch<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success && res.data?.token) {
      setAuthToken(res.data.token);
      if (res.data.user) {
        localStorage.setItem('chatnova_current_user', JSON.stringify(res.data.user));
      }
    }
    return res;
  },

  login: async (payload: { customId: string; password: string }) => {
    const res = await apiFetch<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success && res.data?.token) {
      setAuthToken(res.data.token);
      if (res.data.user) {
        localStorage.setItem('chatnova_current_user', JSON.stringify(res.data.user));
      }
    }
    return res;
  },

  getMe: async () => {
    return apiFetch<{ user: any }>('/auth/me', {
      method: 'GET',
    });
  },
};

// 2. MASTER ADMIN APIS
export const adminAPI = {
  getUsers: async (params?: { search?: string; status?: string; page?: number }) => {
    return apiFetch<{ users: any[]; total: number; page: number }>('/admin/users', {
      method: 'GET',
    });
  },

  toggleBan: async (userId: string, isBanned: boolean, reason?: string) => {
    return apiFetch<{ user: any }>(`/admin/users/${userId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ isBanned, reason }),
    });
  },

  getStats: async () => {
    return apiFetch<{ stats: any }>('/admin/stats', {
      method: 'GET',
    });
  },

  getAuditLogs: async () => {
    return apiFetch<{ logs: any[] }>('/admin/audit-logs', {
      method: 'GET',
    });
  },

  broadcast: async (message: string) => {
    return apiFetch<{ message: string }>('/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};
