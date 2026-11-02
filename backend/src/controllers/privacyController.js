
const PrivacySettings = require('../models/PrivacySettings');
const User = require('../models/User');

const DEFAULT_SETTINGS = {
  lastSeenVisibility: 'everyone',
  profilePhotoVisibility: 'everyone',
  aboutVisibility: 'everyone',
  onlineStatusVisibility: 'everyone',
  readReceipts: true,
  groupInvitePermission: 'everyone'
};

const getPrivacySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('_id isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is unavailable.'
      });
    }

    let settings = await PrivacySettings.findOne({ user: user._id });

    if (!settings) {
      settings = await PrivacySettings.create({
        user: user._id,
        ...DEFAULT_SETTINGS
      });
    }

    return res.status(200).json({
      success: true,
      settings: {
        lastSeenVisibility: settings.lastSeenVisibility,
        profilePhotoVisibility: settings.profilePhotoVisibility,
        aboutVisibility: settings.aboutVisibility,
        onlineStatusVisibility: settings.onlineStatusVisibility,
        readReceipts: settings.readReceipts,
        groupInvitePermission: settings.groupInvitePermission
      }
    });
  } catch (error) {
    console.error('[Privacy Settings Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load privacy settings.'
    });
  }
};

const updatePrivacySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('_id isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is unavailable.'
      });
    }

    const body = req.body || {};
    const updates = {};

    const visibilityFields = [
      'lastSeenVisibility',
      'profilePhotoVisibility',
      'aboutVisibility',
      'onlineStatusVisibility'
    ];

    for (const field of visibilityFields) {
      if (body[field] !== undefined) {
        if (!['everyone', 'contacts', 'nobody'].includes(body[field])) {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${field}.`
          });
        }

        updates[field] = body[field];
      }
    }

    if (body.readReceipts !== undefined) {
      if (typeof body.readReceipts !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Read receipts must be true or false.'
        });
      }

      updates.readReceipts = body.readReceipts;
    }

    if (body.groupInvitePermission !== undefined) {
      if (!['everyone', 'contacts'].includes(body.groupInvitePermission)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid group invitation permission.'
        });
      }

      updates.groupInvitePermission = body.groupInvitePermission;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid privacy settings were provided.'
      });
    }

    const settings = await PrivacySettings.findOneAndUpdate(
      { user: user._id },
      {
        $set: updates,
        // Mongoose schema defaults will fill the remaining fields.
        // Do not repeat fields from $set inside $setOnInsert.
        $setOnInsert: {
          user: user._id
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Privacy settings saved successfully.',
      settings: {
        lastSeenVisibility: settings.lastSeenVisibility,
        profilePhotoVisibility: settings.profilePhotoVisibility,
        aboutVisibility: settings.aboutVisibility,
        onlineStatusVisibility: settings.onlineStatusVisibility,
        readReceipts: settings.readReceipts,
        groupInvitePermission: settings.groupInvitePermission
      }
    });
  } catch (error) {
    console.error('[Privacy Settings Update Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to save privacy settings.'
    });
  }
};

module.exports = {
  getPrivacySettings,
  updatePrivacySettings
};
