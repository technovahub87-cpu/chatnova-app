import { API_BASE_URL, getAuthToken } from './api';

const getToken = () => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login again to send or play videos.');
  }

  return token;
};

const getApiUrl = (path: string) => {
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '');

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('/api/')) {
    return apiOrigin + path;
  }

  return API_BASE_URL + (path.startsWith('/') ? '' : '/') + path;
};

export const uploadVideoMessage = async (
  conversationId: string,
  videoFile: File
) => {
  if (!conversationId) {
    throw new Error('Chat conversation was not found.');
  }

  if (!videoFile || videoFile.size === 0) {
    throw new Error('Please select a video.');
  }

  if (videoFile.size > 50 * 1024 * 1024) {
    throw new Error('Video must be smaller than 50 MB.');
  }

  const allowedTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ];

  if (!allowedTypes.includes(videoFile.type)) {
    throw new Error('Please select an MP4, WebM or MOV video.');
  }

  const token = getToken();

  const response = await fetch(
    getApiUrl(
      '/messages/' + encodeURIComponent(conversationId) + '/video'
    ),
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': videoFile.type,
        'X-File-Name': encodeURIComponent(videoFile.name)
      },
      credentials: 'include',
      body: videoFile,
      signal: AbortSignal.timeout(120000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Video upload failed.');
  }

  return data.message;
};

export const fetchVideoMessage = async (
  videoUrl: string
): Promise<Blob> => {
  if (!videoUrl) {
    throw new Error('Video URL is missing.');
  }

  const token = getToken();

  const response = await fetch(getApiUrl(videoUrl), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token
    },
    credentials: 'include',
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    throw new Error(
      'Unable to load video. Server error: ' + response.status
    );
  }

  return response.blob();
};
