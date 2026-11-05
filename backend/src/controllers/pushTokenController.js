const PushToken = require('../models/PushToken');
const User = require('../models/User');

// Register or refresh an Android FCM device token
const registerPushToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('_id isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is unavailable.'
      });
    }

    const { token, platform, deviceName } = req.body || {};

    if (
      typeof token !== 'string' ||
      token.trim().length < 20 ||
      token.trim().length > 4096
    ) {
      return res.status(400).json({
        success: false,
        message: 'A valid device token is required.'
      });
    }

    if (platform && platform !== 'android') {
      return res.status(400).json({
        success: false,
        message: 'Unsupported device platform.'
      });
    }

    const cleanToken = token.trim();

    await PushToken.findOneAndUpdate(
      { token: cleanToken },
      {
        $set: {
          user: user._id,
          platform: 'android',
          deviceName:
            typeof deviceName === 'string'
              ? deviceName.trim().slice(0, 100)
              : 'Android Device',
          lastActiveAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Device registered for push notifications.'
    });
  } catch (error) {
    console.error('[Push Token Register Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to register this device.'
    });
  }
};

// Remove this device token, for example when logging out
const removePushToken = async (req, res) => {
  try {
    const { token } = req.body || {};

    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required.'
      });
    }

    await PushToken.deleteOne({
      user: req.user._id,
      token: token.trim()
    });

    return res.status(200).json({
      success: true,
      message: 'Device unregistered successfully.'
    });
  } catch (error) {
    console.error('[Push Token Remove Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to unregister this device.'
    });
  }
};

module.exports = {
  registerPushToken,
  removePushToken
};
