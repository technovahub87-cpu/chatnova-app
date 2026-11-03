
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

async function statusRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const token = getAuthToken();
    const headers = new Headers(options.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: AbortSignal.timeout(15000)
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
  } catch {
    return {
      success: false,
      message: 'ChatNova server is unavailable. Please try again.'
    };
  }
}

export const statusAPI = {
  getStatuses: () =>
    statusRequest<{ statuses: StatusRecord[] }>('/auth/statuses'),

  createTextStatus: (text: string) =>
    statusRequest<{ status: StatusRecord }>('/auth/statuses', {
      method: 'POST',
      body: JSON.stringify({
        type: 'text',
        text
      })
    }),

  markViewed: (statusId: string) =>
    statusRequest(`/auth/statuses/${encodeURIComponent(statusId)}/view`, {
      method: 'POST'
    }),

  getViewers: (statusId: string) =>
    statusRequest<{
      viewers: StatusRecord['viewers'];
    }>(`/auth/statuses/${encodeURIComponent(statusId)}/viewers`),

  deleteStatus: (statusId: string) =>
    statusRequest(`/auth/statuses/${encodeURIComponent(statusId)}`, {
      method: 'DELETE'
    })
};
