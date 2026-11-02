const mongoose = require('mongoose');

const NotificationSettingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  messageNotifications: {
    type: Boolean,
    default: true
  },

  groupNotifications: {
    type: Boolean,
    default: true
  },

  callNotifications: {
    type: Boolean,
    default: true
  },

  statusNotifications: {
    type: Boolean,
    default: true
  },

  notificationSound: {
    type: Boolean,
    default: true
  },

  vibration: {
    type: Boolean,
    default: true
  },

  messagePreview: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports =
  mongoose.models.NotificationSettings ||
  mongoose.model('NotificationSettings', NotificationSettingsSchema);
