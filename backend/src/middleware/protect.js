
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');

const getDeviceDetails = (userAgent = '') => {
  const ua = String(userAgent);

  let browser = 'Unknown Browser';
  let operatingSystem = 'Unknown OS';
  let deviceName = 'Unknown Device';

  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  if (/Android/i.test(ua)) {
    operatingSystem = 'Android';
    deviceName = 'Android Device';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    operatingSystem = 'iOS';
    deviceName = 'Apple Device';
  } else if (/Windows/i.test(ua)) {
    operatingSystem = 'Windows';
    deviceName = 'Windows Computer';
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    operatingSystem = 'macOS';
    deviceName = 'Mac Computer';
  } else if (/Linux/i.test(ua)) {
    operatingSystem = 'Linux';
    deviceName = 'Linux Computer';
  }

  return { browser, operatingSystem, deviceName };
};

const protect = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('[Auth] JWT_SECRET is missing.');
      return res.status(500).json({
        success: false,
        message: 'Authentication service is not configured.'
      });
    }

    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication token is required.'
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is empty.'
      });
    }

    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.'
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account not found.'
      });
    }

    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== (user.tokenVersion || 0)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.'
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended.',
        banReason: user.banReason || 'Administrative suspension'
      });
    }

    // A one-way hash identifies this login without storing its JWT.
    const tokenId = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    let session = await Session.findOne({ tokenId });

    if (session && session.revokedAt) {
      return res.status(401).json({
        success: false,
        message: 'This device has been logged out. Please log in again.'
      });
    }

    if (session && session.expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        message: 'This device session has expired. Please log in again.'
      });
    }

    if (!session) {
      const userAgent = req.headers['user-agent'] || '';
      const device = getDeviceDetails(userAgent);

      const expiresAt = decoded.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      try {
        session = await Session.create({
          tokenId,
          user: user._id,
          deviceName: device.deviceName,
          browser: device.browser,
          operatingSystem: device.operatingSystem,
          ipAddress: req.ip || '',
          userAgent: String(userAgent).slice(0, 500),
          lastActiveAt: new Date(),
          expiresAt
        });
      } catch (createError) {
        // Handle two simultaneous first requests for the same login.
        if (createError.code === 11000) {
          session = await Session.findOne({ tokenId });
        } else {
          throw createError;
        }
      }
    }

    if (!session || session.revokedAt) {
      return res.status(401).json({
        success: false,
        message: 'This device session is unavailable. Please log in again.'
      });
    }

    session.lastActiveAt = new Date();
    await session.save();

    req.user = user;
    req.session = session;

    return next();

  } catch (error) {
    console.error(
      '[Auth Protect Middleware Error]:',
      error instanceof Error ? error.message : String(error)
    );

    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please log in again.'
    });
  }
};

module.exports = { protect };
