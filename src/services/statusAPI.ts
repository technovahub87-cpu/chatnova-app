
import { API_BASE_URL, getAuthToken } from './api';

export interface StatusRecord {
  _id: string;
  user: {
    _id: string;
    customId: string;
    displayName: string;
    avatar?: string;
  };
  type: 'text' | 'image' | 'video';
  text?: string;
  mediaUrl?: string;
  caption?: string;
  audience: 'everyone' | 'contacts' | 'nobody';
  viewers: Array<{
    user: {
      _id: string;
      customId: string;
      displayName: string;
      avatar?: string;
    };
    viewedAt: string;
  }>;
  createdAt: string;
  expiresAt: string;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to read selected file.'));
    };
    reader.onerror = () => reject(new Error('File reading failed.'));
    reader.readAsDataURL(file);
  });
}

async function statusRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const token = getAuthToken();
    const headers = new Headers(options.headers);

    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: AbortSignal.timeout(45000)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      return {
        success: false,
        message: result.message || 'Status request failed.'
      };
    }

    return {
      success: true,
      data: result as T,
      message: result.message
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error
        ? error.message
        : 'ChatNova server is unavailable.'
    };
  }
}

export const statusAPI = {
  getStatuses: () =>
    statusRequest<{ statuses: StatusRecord[] }>('/auth/statuses'),

  createTextStatus: (text: string) =>
    statusRequest<{ status: StatusRecord }>('/auth/statuses', {
      method: 'POST',
      body: JSON.stringify({ type: 'text', text })
    }),

  createMediaStatus: async (file: File, caption = '') => {
    const dataUrl = await fileToDataUrl(file);

    return statusRequest<{ status: StatusRecord }>('/auth/statuses/media', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, caption })
    });
  },

  getStatusMedia: async (statusId: string) => {
    try {
      const token = getAuthToken();
      const headers = new Headers();

      if (token) headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(
        `${API_BASE_URL}/auth/statuses/${encodeURIComponent(statusId)}/media`,
        {
          headers,
          credentials: 'include',
          signal: AbortSignal.timeout(30000)
        }
      );

      if (!response.ok) {
        return { success: false, message: 'Unable to load this media.' };
      }

      return { success: true, blob: await response.blob() };
    } catch {
      return { success: false, message: 'Unable to load media.' };
    }
  },

  markViewed: (statusId: string) =>
    statusRequest(`/auth/statuses/${encodeURIComponent(statusId)}/view`, {
      method: 'POST'
    }),

  getViewers: (statusId: string) =>
    statusRequest<{ viewers: StatusRecord['viewers'] }>(
      `/auth/statuses/${encodeURIComponent(statusId)}/viewers`
    ),

  deleteStatus: (statusId: string) =>
    statusRequest(`/auth/statuses/${encodeURIComponent(statusId)}`, {
      method: 'DELETE'
    })
};
