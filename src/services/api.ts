/**
 * ChatNova Real REST API Client
 * Configurable for live Node.js / Express backend with automatic fallback.
 */

// Default to env variable or localhost:5000 backend
export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

// Token Storage Helpers
export const getAuthToken = (): string | null => {
  return localStorage.getItem('chatnova_jwt_token');
};

export const setAuthToken = (token: string) => {
  localStorage.setItem('chatnova_jwt_token', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('chatnova_jwt_token');
};

// Generic Fetch Wrapper with Auth Headers & Timeout
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; isLiveBackend?: boolean }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Master Admin headers if available in session
  const adminSecret = sessionStorage.getItem('chatnova_admin_secret');
  const admin2FA = sessionStorage.getItem('chatnova_admin_2fa');
  if (adminSecret && admin2FA) {
    headers['x-master-admin-secret'] = adminSecret;
    headers['x-master-2fa-token'] = admin2FA;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        message: data?.message || `HTTP ${res.status}: Request failed`,
        isLiveBackend: true,
      };
    }

    return {
      success: true,
      data: data as T,
      message: data?.message,
      isLiveBackend: true,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Backend is offline or not reachable on local port
    return {
      success: false,
      message: error?.name === 'AbortError' ? 'Live backend connection timed out' : 'Live backend server not reachable',
      isLiveBackend: false,
    };
  }
}

// 1. AUTHENTICATION APIS
export const authAPI = {
  register: async (payload: { customId: string; displayName: string; password: string }) => {
    return apiFetch<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login: async (payload: { customId: string; password: string }) => {
    return apiFetch<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());

    return apiFetch<{ users: any[]; total: number; page: number }>(`/admin/users?${query.toString()}`, {
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
