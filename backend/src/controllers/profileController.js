// --------------------------------------------------
// CHATNOVA USER PROFILE CONTROLLER
// --------------------------------------------------

const User = require('../models/User');

// Return only safe, public profile fields.
const getPublicProfile = (user) => ({
  id: String(user._id),
  customId: user.customId,
  displayName: user.displayName,
  avatar: user.avatar,
  bio: user.bio,
  status: user.status,
  lastSeen: user.lastSeen,
  role: user.role,
  createdAt: user.createdAt
});

// --------------------------------------------------
// UPDATE CURRENT USER PROFILE
// --------------------------------------------------

exports.updateProfile = async (req, res) => {
  try {
    const { displayName, bio } = req.body || {};

    const updates = {};

    if (displayName !== undefined) {
      if (typeof displayName !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Display name must be text.'
        });
      }

      const cleanName = displayName.trim();

      if (!cleanName || cleanName.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Display name must be between 1 and 50 characters.'
        });
      }

      updates.displayName = cleanName;
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'About must be text.'
        });
      }

      const cleanBio = bio.trim();

      if (cleanBio.length > 160) {
        return res.status(400).json({
          success: false,
          message: 'About cannot exceed 160 characters.'
        });
      }

      updates.bio = cleanBio;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No profile changes were provided.'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user || user.isBanned) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    Object.assign(user, updates);

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: getPublicProfile(user)
    });

  } catch (error) {
    console.error('[Profile Update Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update profile. Please try again.'
    });
  }
};
