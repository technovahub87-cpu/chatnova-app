
/**
 * ChatNova Secure API Client
 * No mock login, no local authentication fallback.
 */

export const API_BASE_URL =
  'https://chatnova-app-n20j.onrender.com/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  isLiveBackend: boolean;
}

export interface AdminCredentials {
  secret: string;
  authenticatorCode: string;
}

// --------------------------------------------------
// AUTH TOKEN STORAGE
// --------------------------------------------------

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('chatnova_jwt_token');
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string): void => {
  try {
    if (token) {
      localStorage.setItem('chatnova_jwt_token', token);
    }
  } catch {
    // Storage may be unavailable.
  }
};

export const removeAuthToken = (): void => {
  try {
    localStorage.removeItem('chatnova_jwt_token');
  } catch {
    // Storage may be unavailable.
  }
};

// --------------------------------------------------
// CENTRAL API REQUEST
// --------------------------------------------------

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  adminCredentials?: AdminCredentials
): Promise<ApiResponse<T>> {
  try {
    const headers = new Headers(options.headers);

    headers.set('Content-Type', 'application/json');

    const token = getAuthToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (adminCredentials) {
      headers.set(
        'x-master-admin-secret',
        adminCredentials.secret
      );

      headers.set(
        'x-master-2fa-token',
        adminCredentials.authenticatorCode
      );
    }

    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers,
        credentials: 'include',
        signal: AbortSignal.timeout(15000)
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      return {
        success: false,
        message:
          result.message ||
          `Request failed with status ${response.status}`,
        isLiveBackend: true
      };
    }

    return {
      success: true,
      data: (result.data !== undefined ? result.data : result) as T,
      message: result.message || 'Success',
      isLiveBackend: true
    };

  } catch (error) {
    console.error('[ChatNova API Error]:', error);

    return {
      success: false,
      message:
        'ChatNova server is unavailable. Please try again later.',
      isLiveBackend: false
    };
  }
}

// --------------------------------------------------
// AUTHENTICATION APIS
// --------------------------------------------------

export const authAPI = {
  register: async (payload: {
    customId: string;
    displayName: string;
    password: string;
    mobileNumber: string;
  }) => {
    return apiFetch<{
      customId: string;
      otpRequired: boolean;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  verifyRegistrationOtp: async (payload: {
    customId: string;
    otp: string;
  }) => {
    return apiFetch<{
      token: string;
      user: any;
    }>('/auth/verify-registration-otp', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  setupAuthenticator: async () => {
    return apiFetch<{
      qrCode: string;
      manualEntryKey: string;
    }>('/auth/authenticator/setup', {
      method: 'POST'
    });
  },

  verifyAuthenticatorSetup: async (code: string) => {
    return apiFetch<{
      recoveryCodes: string[];
    }>('/auth/authenticator/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  login: async (payload: {
    customId: string;
    password: string;
    authenticatorCode?: string;
    recoveryCode?: string;
  }) => {
    return apiFetch<{
      token: string;
      user: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  forgotPassword: async (payload: {
    customId: string;
    authenticatorCode?: string;
    recoveryCode?: string;
    newPassword: string;
  }) => {
    return apiFetch<{
      message: string;
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getMe: async () => {
    return apiFetch<{
      user: any;
    }>('/auth/me', {
      method: 'GET'
    });
  }
};

// --------------------------------------------------
// MASTER ADMIN APIS
// --------------------------------------------------

export const adminAPI = {
  getUsers: async (
    credentials: AdminCredentials,
    params?: {
      search?: string;
      status?: string;
      page?: number;
    }
  ) => {
    const query = new URLSearchParams();

    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));

    const suffix = query.toString() ? `?${query.toString()}` : '';

    return apiFetch<{
      users: any[];
      total: number;
      page: number;
    }>(
      `/admin/users${suffix}`,
      { method: 'GET' },
      credentials
    );
  },

  toggleBan: async (
    credentials: AdminCredentials,
    userId: string,
    isBanned: boolean,
    reason?: string
  ) => {
    return apiFetch<{ user: any }>(
      `/admin/users/${encodeURIComponent(userId)}/ban`,
      {
        method: 'PUT',
        body: JSON.stringify({ isBanned, reason })
      },
      credentials
    );
  },

  getStats: async (credentials: AdminCredentials) => {
    return apiFetch<{ stats: any }>(
      '/admin/stats',
      { method: 'GET' },
      credentials
    );
  },

  getAuditLogs: async (credentials: AdminCredentials) => {
    return apiFetch<{ logs: any[] }>(
      '/admin/audit-logs',
      { method: 'GET' },
      credentials
    );
  },

  broadcast: async (
    credentials: AdminCredentials,
    message: string
  ) => {
    return apiFetch<{ message: string }>(
      '/admin/broadcast',
      {
        method: 'POST',
        body: JSON.stringify({ message })
      },
      credentials
    );
  }
};
