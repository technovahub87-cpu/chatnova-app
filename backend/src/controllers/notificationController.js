const NotificationSettings = require('../models/NotificationSettings');
const User = require('../models/User');

const DEFAULTS = {
  messageNotifications: true,
  groupNotifications: true,
  callNotifications: true,
  statusNotifications: true,
  notificationSound: true,
  vibration: true,
  messagePreview: true
};

// Get notification settings
const getNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('_id isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is unavailable.'
      });
    }

    const settings = await NotificationSettings.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    const values = {};

    for (const key of Object.keys(DEFAULTS)) {
      values[key] = settings[key];
    }

    return res.status(200).json({
      success: true,
      settings: values
    });

  } catch (error) {
    console.error('[Notification Settings Load Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load notification settings.'
    });
  }
};

// Update notification settings
const updateNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('_id isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is unavailable.'
      });
    }

    const body = req.body || {};
    const updates = {};

    for (const key of Object.keys(DEFAULTS)) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') {
          return res.status(400).json({
            success: false,
            message: `${key} must be true or false.`
          });
        }

        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid notification settings were provided.'
      });
    }

    const settings = await NotificationSettings.findOneAndUpdate(
      { user: user._id },
      {
        $set: updates,
        $setOnInsert: { user: user._id }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const values = {};

    for (const key of Object.keys(DEFAULTS)) {
      values[key] = settings[key];
    }

    return res.status(200).json({
      success: true,
      message: 'Notification preferences saved successfully.',
      settings: values
    });

  } catch (error) {
    console.error('[Notification Settings Update Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to save notification settings.'
    });
  }
};

module.exports = {
  getNotificationSettings,
  updateNotificationSettings
};
