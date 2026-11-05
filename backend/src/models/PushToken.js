const mongoose = require('mongoose');

const PushTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    token: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    platform: {
      type: String,
      enum: ['android'],
      default: 'android'
    },

    deviceName: {
      type: String,
      default: 'Android Device',
      maxlength: 100
    },

    lastActiveAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

PushTokenSchema.index({ user: 1, lastActiveAt: -1 });

module.exports =
  mongoose.models.PushToken ||
  mongoose.model('PushToken', PushTokenSchema);
