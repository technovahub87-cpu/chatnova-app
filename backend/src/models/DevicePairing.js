
const mongoose = require('mongoose');

const DevicePairingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Hash of the secret placed inside the QR code.
    pairCodeHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // The already logged-in device that started pairing.
    sourceSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true
    },

    sourceTokenId: {
      type: String,
      required: true
    },

    // Set when another device successfully scans the QR.
    claimSecretHash: {
      type: String,
      default: null,
      select: false
    },

    status: {
      type: String,
      enum: [
        'pending',
        'claimed',
        'approved',
        'rejected',
        'consumed'
      ],
      default: 'pending',
      index: true
    },

    targetDeviceName: {
      type: String,
      default: 'Unknown Device',
      maxlength: 100
    },

    targetBrowser: {
      type: String,
      default: 'Unknown Browser',
      maxlength: 100
    },

    targetOperatingSystem: {
      type: String,
      default: 'Unknown OS',
      maxlength: 100
    },

    targetUserAgent: {
      type: String,
      default: '',
      maxlength: 500
    },

    targetIpAddress: {
      type: String,
      default: '',
      maxlength: 100
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true
    },

    claimedAt: {
      type: Date,
      default: null
    },

    approvedAt: {
      type: Date,
      default: null
    },

    consumedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Automatically remove expired pairing records.
DevicePairingSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

DevicePairingSchema.index({
  user: 1,
  status: 1,
  createdAt: -1
});

module.exports =
  mongoose.models.DevicePairing ||
  mongoose.model('DevicePairing', DevicePairingSchema);
