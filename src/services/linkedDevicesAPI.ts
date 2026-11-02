
import { API_BASE_URL, getAuthToken } from './api';

const request = async (
  endpoint: string,
  method = 'GET',
  body?: Record<string, unknown>,
  requiresAuth = true
) => {
  try {
    const token = requiresAuth ? getAuthToken() : null;

    if (requiresAuth && !token) {
      return {
        success: false,
        message: 'Please log in again.'
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const result = await response.json();

    if (!response.ok || result.success === false) {
      return {
        success: false,
        message: result.message || 'Request failed.'
      };
    }

    return {
      success: true,
      ...result
    };
  } catch {
    return {
      success: false,
      message: 'Unable to connect to ChatNova server.'
    };
  }
};

export const linkedDevicesAPI = {
  getDevices: async () => {
    return request('/auth/sessions');
  },

  removeDevice: async (sessionId: string) => {
    return request(
      `/auth/sessions/${encodeURIComponent(sessionId)}`,
      'DELETE'
    );
  },

  createPairing: async () => {
    return request('/auth/device-pairing/create', 'POST');
  },

  claimPairing: async (pairCode: string) => {
    return request(
      '/auth/device-pairing/claim',
      'POST',
      { pairCode },
      false
    );
  },

  getPairingStatus: async (pairingId: string) => {
    return request(
      `/auth/device-pairing/${encodeURIComponent(pairingId)}/status`
    );
  },

  approvePairing: async (pairingId: string) => {
    return request(
      `/auth/device-pairing/${encodeURIComponent(pairingId)}/approve`,
      'POST'
    );
  },

  rejectPairing: async (pairingId: string) => {
    return request(
      `/auth/device-pairing/${encodeURIComponent(pairingId)}/reject`,
      'POST'
    );
  },

  completePairing: async (
    pairingId: string,
    claimSecret: string
  ) => {
    return request(
      '/auth/device-pairing/complete',
      'POST',
      { pairingId, claimSecret },
      false
    );
  }
};
