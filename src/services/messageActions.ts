
import { API_BASE_URL, getAuthToken } from './api';

export type MessageActionType =
  | 'reply'
  | 'forward'
  | 'delete_for_me'
  | 'delete_for_everyone';

interface MessageActionPayload {
  action: MessageActionType;
  content?: string;
  targetConversationId?: string;
}

interface MessageActionResponse {
  success: boolean;
  message?: string;
  data?: {
    message?: any;
  };
}

export const performMessageAction = async (
  conversationId: string,
  messageId: string,
  payload: MessageActionPayload
): Promise<MessageActionResponse> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login again to continue.');
  }

  const response = await fetch(
    `${API_BASE_URL}/messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(messageId)}/action`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000)
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || 'Message action could not be completed.'
    );
  }

  return result;
};
