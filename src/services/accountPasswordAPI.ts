
import { API_BASE_URL, getAuthToken } from './api';

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  authenticatorCode?: string;
  recoveryCode?: string;
}

export const accountPasswordAPI = {
  changePassword: async (payload: ChangePasswordPayload) => {
    try {
      const token = getAuthToken();

      if (!token) {
        return {
          success: false,
          message: 'Please log in again.'
        };
      }

      const response = await fetch(
        `${API_BASE_URL}/auth/change-password`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        return {
          success: false,
          message: result.message || 'Password could not be changed.'
        };
      }

      return {
        success: true,
        message: result.message || 'Password changed successfully.'
      };
    } catch (error) {
      console.error('[Account Password API Error]:', error);

      return {
        success: false,
        message: 'ChatNova server is unavailable. Please try again.'
      };
    }
  }
};
