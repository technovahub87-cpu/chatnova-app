
import { API_BASE_URL, getAuthToken } from './api';

export interface LinkedDevice {
  _id: string;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
}

const request = async (endpoint: string, method = 'GET') => {
  try {
    const token = getAuthToken();

    if (!token) {
      return {
        success: false,
        message: 'Please log in again.'
      };
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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
  }
};
