const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const parts = authHeader.split(' ');
      if (parts.length === 2) {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No cryptographic authorization token provided.',
      });
    }

    const secret = process.env.JWT_SECRET || 'chatnova_super_secret_jwt_key_2026_post_quantum';
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload signature.',
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Decentralized identity not found.',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Identity has been suspended by Master Administration.',
        banReason: user.banReason || 'Administrative suspension',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Auth Protect Middleware Error]:', errorMsg);
    return res.status(401).json({
      success: false,
      message: 'Token verification failed or signature expired.',
    });
  }
};

module.exports = { protect };
