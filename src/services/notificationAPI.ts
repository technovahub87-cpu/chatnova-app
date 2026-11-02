
import { API_BASE_URL, getAuthToken } from './api';

export type NotificationSettingsData = {
  messageNotifications: boolean;
  groupNotifications: boolean;
  callNotifications: boolean;
  statusNotifications: boolean;
  notificationSound: boolean;
  vibration: boolean;
  messagePreview: boolean;
};

type NotificationResponse = {
  success: boolean;
  message?: string;
  settings?: NotificationSettingsData;
};

async function request(
  method: 'GET' | 'PUT',
  payload?: Partial<NotificationSettingsData>
): Promise<NotificationResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      message: 'Please log in again.'
    };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/auth/notifications`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: payload ? JSON.stringify(payload) : undefined
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      return {
        success: false,
        message:
          result.message || 'Unable to process notification settings.'
      };
    }

    return {
      success: true,
      settings: result.settings,
      message: result.message || 'Success'
    };
  } catch {
    return {
      success: false,
      message: 'ChatNova server is unavailable.'
    };
  }
}

export const notificationAPI = {
  get: () => request('GET'),

  update: (payload: Partial<NotificationSettingsData>) =>
    request('PUT', payload)
};
