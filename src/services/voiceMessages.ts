
import { API_BASE_URL, getAuthToken } from './api';

const getToken = () => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login again to send or play voice messages.');
  }

  return token;
};

const getApiUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const uploadVoiceMessage = async (
  conversationId: string,
  audioBlob: Blob,
  durationSeconds: number
) => {
  if (!conversationId) {
    throw new Error('Chat conversation was not found.');
  }

  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Voice recording is empty.');
  }

  if (audioBlob.size > 10 * 1024 * 1024) {
    throw new Error('Voice message must be smaller than 10 MB.');
  }

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > 300
  ) {
    throw new Error('Voice message must be between 1 and 300 seconds.');
  }

  const token = getToken();
  const contentType = audioBlob.type.split(';')[0] || 'audio/webm';

  const response = await fetch(
    getApiUrl(`/messages/${encodeURIComponent(conversationId)}/voice`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'X-Audio-Duration': String(Math.round(durationSeconds))
      },
      credentials: 'include',
      body: audioBlob,
      signal: AbortSignal.timeout(30000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Voice message upload failed.');
  }

  return data.message;
};

export const fetchVoiceAudio = async (
  audioUrl: string
): Promise<Blob> => {
  if (!audioUrl) {
    throw new Error('Voice audio URL is missing.');
  }

  const token = getToken();

  const response = await fetch(getApiUrl(audioUrl), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    },
    credentials: 'include',
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error('Unable to load voice message audio.');
  }

  return response.blob();
};
