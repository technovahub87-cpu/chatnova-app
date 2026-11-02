
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const User = require('../models/User');

const safeCompare = (first, second) => {
  if (typeof first !== 'string' || typeof second !== 'string') {
    return false;
  }

  const a = Buffer.from(first);
  const b = Buffer.from(second);

  return (
    a.length > 0 &&
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
};

const masterAdminProtect = async (req, res, next) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    const adminSecret = process.env.MASTER_ADMIN_SECRET;
    const totpSecret = process.env.MASTER_ADMIN_TOTP_SECRET;

    if (!jwtSecret || !adminSecret || !totpSecret) {
      return res.status(503).json({
        success: false,
        message: 'Master Admin security is not configured.'
      });
    }

    // First verify the logged-in ChatNova account.
    const authHeader = req.headers.authorization;

    if (
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        success: false,
        message: 'ChatNova login is required.'
      });
    }

    const token = authHeader.substring(7).trim();
    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login session.'
      });
    }

    const user = await User.findById(decoded.id);

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account access denied.'
      });
    }

    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== (user.tokenVersion || 0)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Login session has expired.'
      });
    }

    // Only the designated Master Admin account may continue.
    if (user.role !== 'master_admin') {
      return res.status(403).json({
        success: false,
        message: 'Master Admin account required.'
      });
    }

    // Verify the additional Master Admin credentials.
    const suppliedSecret = req.headers['x-master-admin-secret'];
    const suppliedToken = req.headers['x-master-2fa-token'];

    const secretValid = safeCompare(suppliedSecret, adminSecret);

    const tokenValid =
      typeof suppliedToken === 'string' &&
      /^\d{6}$/.test(suppliedToken) &&
      speakeasy.totp.verify({
        secret: totpSecret,
        encoding: 'base32',
        token: suppliedToken,
        window: 1
      });

    if (!secretValid || !tokenValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid Master Admin credentials.'
      });
    }

    req.user = user;
    return next();

  } catch (error) {
    console.error(
      '[Master Admin Security Error]:',
      error instanceof Error ? error.message : String(error)
    );

    return res.status(401).json({
      success: false,
      message: 'Master Admin verification failed.'
    });
  }
};

module.exports = { masterAdminProtect };
