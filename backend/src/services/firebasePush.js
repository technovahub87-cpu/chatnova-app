
const crypto = require('crypto');

let cachedAccessToken = null;
let tokenExpiresAt = 0;

const base64Url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const getServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured.');
  }

  const account = JSON.parse(raw);

  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error('Firebase service account credentials are incomplete.');
  }

  account.private_key = account.private_key.replace(/\\n/g, '\n');

  return account;
};

const getAccessToken = async (account) => {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const now = Math.floor(Date.now() / 1000);

  const header = base64Url(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  );

  const payload = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })
  );

  const unsignedToken = `${header}.${payload}`;

  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(unsignedToken), account.private_key)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error(
      result.error_description || result.error || 'Firebase access token failed.'
    );
  }

  cachedAccessToken = result.access_token;
  tokenExpiresAt = Date.now() + (result.expires_in || 3600) * 1000;

  return cachedAccessToken;
};

const sendPushNotification = async ({
  deviceToken,
  title,
  body,
  data = {}
}) => {
  try {
    if (!deviceToken) {
      return { success: false, reason: 'Missing device token.' };
    }

    const account = getServiceAccount();
    const accessToken = await getAccessToken(account);

    const safeData = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        safeData[String(key)] = String(value);
      }
    }

    const isCallNotification =
      safeData.notificationType === 'call';

    const notification = {
      title: String(title || 'ChatNova'),
      body: String(body || 'You have a new notification.')
    };

    if (safeData.callId) {
      notification.tag = safeData.callId;
    }

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification,
            data: safeData,
            android: {
              priority: 'high',
              notification: {
                channel_id: isCallNotification
                  ? 'chatnova_calls'
                  : 'chatnova_messages',
                tag: safeData.callId || undefined
              }
            }
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[FCM Send Error]:', result);

      return {
        success: false,
        reason: result.error?.message || 'FCM delivery failed.',
        invalidToken:
          result.error?.details?.some(
            (item) =>
              item.errorCode === 'UNREGISTERED' ||
              item.errorCode === 'INVALID_ARGUMENT'
          ) || false
      };
    }

    return {
      success: true,
      messageId: result.name
    };
  } catch (error) {
    console.error('[Firebase Push Error]:', error.message);

    return {
      success: false,
      reason: error.message
    };
  }
};

module.exports = {
  sendPushNotification
};
