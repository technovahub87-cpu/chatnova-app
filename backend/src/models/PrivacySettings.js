const mongoose = require('mongoose');

const PrivacySettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    lastSeenVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone'
    },

    profilePhotoVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone'
    },

    aboutVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone'
    },

    onlineStatusVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone'
    },

    readReceipts: {
      type: Boolean,
      default: true
    },

    groupInvitePermission: {
      type: String,
      enum: ['everyone', 'contacts'],
      default: 'everyone'
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.PrivacySettings ||
  mongoose.model('PrivacySettings', PrivacySettingsSchema);
