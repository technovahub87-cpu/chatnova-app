
const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    deviceName: {
      type: String,
      default: 'Unknown Device',
      trim: true,
      maxlength: 100
    },

    browser: {
      type: String,
      default: 'Unknown Browser',
      trim: true,
      maxlength: 100
    },

    operatingSystem: {
      type: String,
      default: 'Unknown OS',
      trim: true,
      maxlength: 100
    },

    ipAddress: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100
    },

    userAgent: {
      type: String,
      default: '',
      maxlength: 500
    },

    lastActiveAt: {
      type: Date,
      default: Date.now
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true
    },

    revokedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

SessionSchema.index({ user: 1, revokedAt: 1 });

module.exports =
  mongoose.models.Session ||
  mongoose.model('Session', SessionSchema);
