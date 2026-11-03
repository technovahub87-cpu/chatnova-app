
import { API_BASE_URL, getAuthToken } from './api';

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

const getToken = () => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login again to send or open attachments.');
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

export const uploadAttachment = async (
  conversationId: string,
  file: File
) => {
  if (!conversationId) {
    throw new Error('Chat conversation was not found.');
  }

  if (!file || file.size === 0) {
    throw new Error('Please select a file.');
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error('Attachment must be smaller than 25 MB.');
  }

  if (
    file.type.startsWith('image/') &&
    !ALLOWED_IMAGE_TYPES.includes(file.type)
  ) {
    throw new Error('Please select JPG, PNG, GIF or WEBP image.');
  }

  const token = getToken();

  const response = await fetch(
    getApiUrl(
      '/messages/' +
      encodeURIComponent(conversationId) +
      '/attachment'
    ),
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name)
      },
      credentials: 'include',
      body: file,
      signal: AbortSignal.timeout(120000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Attachment upload failed.');
  }

  return data.message;
};

export const fetchAttachment = async (
  attachmentUrl: string
): Promise<Blob> => {
  if (!attachmentUrl) {
    throw new Error('Attachment URL is missing.');
  }

  const token = getToken();

  const response = await fetch(getApiUrl(attachmentUrl), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token
    },
    credentials: 'include',
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    throw new Error(
      'Unable to open attachment. Server error: ' + response.status
    );
  }

  return response.blob();
};
