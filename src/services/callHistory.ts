
import { API_BASE_URL, getAuthToken } from './api';

export type CallHistoryType = 'all' | 'voice' | 'video';

export interface CallHistoryItem {
  id: string;
  conversationId: string | null;
  type: 'voice' | 'video';
  status: 'ringing' | 'answered' | 'ended' | 'missed' | 'rejected' | 'failed';
  direction: 'incoming' | 'outgoing';
  contact: {
    _id: string;
    customId: string;
    displayName: string;
    avatar?: string;
  } | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  duration: number;
}

export interface CallHistoryResponse {
  success: boolean;
  calls: CallHistoryItem[];
  message?: string;
}

export const getCallHistory = async (
  type: CallHistoryType = 'all'
): Promise<CallHistoryResponse> => {
  try {
    const token = getAuthToken();

    if (!token) {
      return {
        success: false,
        calls: [],
        message: 'Please log in to view call history.'
      };
    }

    const response = await fetch(
      `${API_BASE_URL}/calls?type=${type}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        signal: AbortSignal.timeout(15000)
      }
    );

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      return {
        success: false,
        calls: [],
        message: result.message || 'Unable to load call history.'
      };
    }

    return {
      success: true,
      calls: Array.isArray(result.calls) ? result.calls : []
    };
  } catch (error) {
    console.error('[Call History Service Error]:', error);

    return {
      success: false,
      calls: [],
      message: 'Unable to connect to ChatNova server.'
    };
  }
};
