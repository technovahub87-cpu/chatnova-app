
import { API_BASE_URL, getAuthToken } from './api';

export const sendGifStickerMessage = async (
  conversationId: string,
  url: string,
  type: 'gif' | 'sticker'
) => {
  if (!conversationId) {
    throw new Error('Chat conversation was not found.');
  }

  if (!url) {
    throw new Error('GIF or sticker URL is missing.');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid GIF or sticker URL.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only secure HTTPS media links are allowed.');
  }

  const allowedHosts = [
    'media.tenor.com',
    'tenor.com',
    'giphy.com',
    'media.giphy.com',
    'i.giphy.com'
  ];

  const isAllowed = allowedHosts.some(host =>
    parsedUrl.hostname === host ||
    parsedUrl.hostname.endsWith('.' + host)
  );

  if (!isAllowed) {
    throw new Error('This GIF or sticker provider is not supported.');
  }

  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login again to send GIFs or stickers.');
  }

  const response = await fetch(
    `${API_BASE_URL}/messages/${encodeURIComponent(conversationId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        type,
        content: type === 'gif' ? 'GIF attachment' : 'Sticker',
        media: {
          type,
          url,
          name: type === 'gif' ? 'ChatNova GIF' : 'ChatNova Sticker',
          size: '0',
          mimeType: 'image/gif'
        }
      }),
      signal: AbortSignal.timeout(30000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to send GIF or sticker.');
  }

  return data.message;
};
