
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    customId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^@[a-z0-9_]{3,24}$/, 'ChatNova ID must start with @ and contain 3-24 valid characters'],
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    mobileNumber: {
      type: String,
      trim: true,
      default: null,
    },

    mobileVerified: {
      type: Boolean,
      default: false,
    },

    // Registration SMS OTP: only temporary hashed OTP is stored.
    registrationOtpHash: {
      type: String,
      default: null,
      select: false,
    },

    registrationOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    registrationOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    registrationOtpLastSentAt: {
      type: Date,
      default: null,
      select: false,
    },

    // Authenticator App (TOTP) settings.
    authenticatorSecretEncrypted: {
      type: String,
      default: null,
      select: false,
    },

    pendingAuthenticatorSecretEncrypted: {
      type: String,
      default: null,
      select: false,
    },

    authenticatorEnabled: {
      type: Boolean,
      default: false,
    },

    recoveryCodesHash: {
      type: [String],
      default: [],
      select: false,
    },

    // Increment this to invalidate previously issued JWT sessions.
    tokenVersion: {
      type: Number,
      default: 0,
    },

    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      trim: true,
    },

    bio: {
      type: String,
      default: 'ChatNova secure communicator',
      maxlength: 160,
      trim: true,
    },

    status: {
      type: String,
      enum: ['online', 'offline', 'away'],
      default: 'offline',
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    publicKeyFingerprint: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      enum: ['user', 'admin', 'master_admin'],
      default: 'user',
    },

    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },

    banReason: {
      type: String,
      default: '',
      trim: true,
    },

    bannedAt: {
      type: Date,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    currentSocketId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving.
UserSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare entered password with stored hash.
UserSchema.methods.comparePassword = async function (enteredPassword) {
  try {
    if (!enteredPassword || !this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    return false;
  }
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
