
import { API_BASE_URL, getAuthToken } from './api';

export type PrivacySettingsData = {
  lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  profilePhotoVisibility: 'everyone' | 'contacts' | 'nobody';
  aboutVisibility: 'everyone' | 'contacts' | 'nobody';
  onlineStatusVisibility: 'everyone' | 'contacts' | 'nobody';
  statusVisibility: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  groupInvitePermission: 'everyone' | 'contacts';
};

type PrivacyResponse = {
  success: boolean;
  message?: string;
  settings?: PrivacySettingsData;
};

async function request(
  method: 'GET' | 'PUT',
  payload?: Partial<PrivacySettingsData>
): Promise<PrivacyResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      message: 'Please log in again.'
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/privacy`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: payload ? JSON.stringify(payload) : undefined
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      return {
        success: false,
        message: result.message || 'Unable to process privacy settings.'
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

export const privacyAPI = {
  get: () => request('GET'),
  update: (payload: Partial<PrivacySettingsData>) =>
    request('PUT', payload)
};
