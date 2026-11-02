import {
  API_BASE_URL,
  getAuthToken
} from './api';

export const profileImageAPI = {
  upload: async (file: File) => {
    try {
      if (file.size > 2 * 1024 * 1024) {
        return {
          success: false,
          message: 'Photo must be 2 MB or smaller.'
        };
      }

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      if (!allowedTypes.includes(file.type)) {
        return {
          success: false,
          message: 'Only JPG, PNG and WEBP photos are allowed.'
        };
      }

      const dataUrl = await new Promise<string>(
        (resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Unable to read photo.'));
            }
          };

          reader.onerror = () => {
            reject(new Error('Unable to read photo.'));
          };

          reader.readAsDataURL(file);
        }
      );

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/auth/profile-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {})
          },
          body: JSON.stringify({ dataUrl })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          message: result.message || 'Photo upload failed.'
        };
      }

      return {
        success: true,
        message: result.message,
        avatar: result.avatar
      };
    } catch (error) {
      console.error('[Profile Photo Upload]', error);

      return {
        success: false,
        message: 'Unable to upload photo. Please try again.'
      };
    }
  },

  remove: async () => {
    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/auth/profile-image`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {})
          }
        }
      );

      const result = await response.json();

      return {
        success: response.ok && result.success,
        message: result.message || 'Photo removal failed.'
      };
    } catch (error) {
      console.error('[Profile Photo Remove]', error);

      return {
        success: false,
        message: 'Unable to remove photo. Please try again.'
      };
    }
  }
};
