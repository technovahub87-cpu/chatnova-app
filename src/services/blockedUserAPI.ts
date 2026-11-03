
import { API_BASE_URL, getAuthToken } from './api';

export interface BlockedUserRecord {
  blockId: string;
  user: {
    _id: string;
    customId: string;
    displayName: string;
    avatar?: string;
    bio?: string;
  };
  blockedAt: string;
}

const request = async (
  endpoint: string,
  method: string = 'GET',
  body?: Record<string, string>
) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  const token = getAuthToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'Request failed.');
  }

  return result;
};

export const blockedUserAPI = {
  getBlockedUsers: async (): Promise<BlockedUserRecord[]> => {
    const result = await request('/blocked-users');
    return result.blockedUsers || [];
  },

  blockUser: async (customId: string) => {
    return request('/blocked-users', 'POST', { customId });
  },

  unblockUser: async (blockId: string) => {
    return request(
      `/blocked-users/${encodeURIComponent(blockId)}`,
      'DELETE'
    );
  }
};
