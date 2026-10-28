const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No cryptographic authorization token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chatnova_super_secret_jwt_key_2026_post_quantum');
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
        banReason: user.banReason,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token verification failed or signature expired.',
    });
  }
};

module.exports = { protect };
