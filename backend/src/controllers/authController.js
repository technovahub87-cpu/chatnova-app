const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'chatnova_super_secret_jwt_key_2026_post_quantum',
    { expiresIn: '30d' }
  );
};

// Helper to generate Curve25519 style fingerprint
const generateFingerprint = () => {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    parts.push(Math.floor(1000 + Math.random() * 9000).toString());
  }
  return parts.join(' ');
};

// @desc    Register new Custom ID identity
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    let { customId, displayName, password } = req.body;

    if (!customId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Custom Username/ID and Password.',
      });
    }

    // Ensure format starts with @
    customId = customId.trim().toLowerCase();
    if (!customId.startsWith('@')) {
      customId = `@${customId}`;
    }

    // Check if custom ID already taken
    const existingUser = await User.findOne({ customId });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `Identity ${customId} is already registered on the network.`,
      });
    }

    // Create user
    const user = await User.create({
      customId,
      displayName: displayName?.trim() || customId.replace('@', ''),
      password,
      publicKeyFingerprint: generateFingerprint(),
      role: 'user',
      twoFactorEnabled: true,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Cryptographic identity created successfully.',
      token,
      user: {
        id: user._id,
        customId: user.customId,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        publicKeyFingerprint: user.publicKeyFingerprint,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error('[Auth Register Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating identity.',
    });
  }
};

// @desc    Login with Custom ID and Password
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    let { customId, password } = req.body;

    if (!customId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide Custom Username/ID and Password.',
      });
    }

    customId = customId.trim().toLowerCase();
    if (!customId.startsWith('@')) {
      customId = `@${customId}`;
    }

    // Find user with password selected
    const user = await User.findOne({ customId }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identity not found. Please verify your Custom ID.',
      });
    }

    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'This identity has been suspended by Master Administration.',
        banReason: user.banReason || 'Administrative suspension',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid passphrase credentials.',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Decryption session authenticated successfully.',
      token,
      user: {
        id: user._id,
        customId: user.customId,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        publicKeyFingerprint: user.publicKeyFingerprint,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error('[Auth Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};
