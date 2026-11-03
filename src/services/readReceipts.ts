
import {
  API_BASE_URL,
  getAuthToken
} from './api';

export const markConversationMessagesRead = async (
  conversationId: string
): Promise<boolean> => {
  if (!conversationId) return false;

  const token = getAuthToken();

  if (!token) return false;

  try {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(conversationId)}/read`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include'
      }
    );

    if (!response.ok) {
      console.error(
        '[ChatNova] Unable to mark messages as read:',
        response.status
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      '[ChatNova] Read receipt error:',
      error
    );
    return false;
  }
};
