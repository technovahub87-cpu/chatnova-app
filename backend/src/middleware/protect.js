
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    // JWT secret must be configured in the server environment.
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('[Auth] JWT_SECRET is missing.');
      return res.status(500).json({
        success: false,
        message: 'Authentication service is not configured.',
      });
    }

    // Read Bearer token.
    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication token is required.',
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is empty.',
      });
    }

    // Verify token signature and expiration.
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    // Find the account.
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account not found.',
      });
    }

    // Reject tokens issued before a password reset when the
    // token contains a tokenVersion claim.
    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== (user.tokenVersion || 0)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
      });
    }

    // Block suspended accounts.
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended.',
        banReason: user.banReason || 'Administrative suspension',
      });
    }

    req.user = user;
    return next();

  } catch (error) {
    console.error(
      '[Auth Protect Middleware Error]:',
      error instanceof Error ? error.message : String(error)
    );

    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please log in again.',
    });
  }
};

module.exports = { protect };
