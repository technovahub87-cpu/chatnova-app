const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    customId: {
      type: String,
      required: [true, 'Custom Username/ID is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^@[a-z0-9_]{3,24}$/, 'Custom ID must start with @ and be 3-24 characters (a-z, 0-9, _)'],
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: 50,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Do not expose password by default in queries
    },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      trim: true,
    },
    bio: {
      type: String,
      default: 'ChatNova encrypted communicator • Zero Logs',
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
      default: true,
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

// Hash password before saving
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

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
  try {
    if (!enteredPassword || !this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    return false;
  }
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
