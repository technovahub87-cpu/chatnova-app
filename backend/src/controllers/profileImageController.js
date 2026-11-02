
const mongoose = require('mongoose');
const ProfileImage = require('../models/ProfileImage');
const User = require('../models/User');

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

const MAX_SIZE = 2 * 1024 * 1024;

// Upload or replace profile image.
exports.uploadProfileImage = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a profile photo.'
      });
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPG, PNG and WEBP images are allowed.'
      });
    }

    if (file.size > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'Profile photo must be 2 MB or smaller.'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user || user.isBanned) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    await ProfileImage.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        data: file.buffer,
        contentType: file.mimetype,
        size: file.size
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const avatarUrl = `/api/profile-images/${user._id}`;

    user.avatar = avatarUrl;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully.',
      avatar: avatarUrl
    });
  } catch (error) {
    console.error('[Profile Image Upload]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to upload profile photo.'
    });
  }
};

// Serve profile image.
exports.getProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID.'
      });
    }

    const image = await ProfileImage.findOne({
      user: userId
    }).lean();

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Profile photo not found.'
      });
    }

    res.set({
      'Content-Type': image.contentType,
      'Content-Length': String(image.size),
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    });

    return res.status(200).send(image.data);
  } catch (error) {
    console.error('[Profile Image Read]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load profile photo.'
    });
  }
};

// Delete current user's profile image.
exports.deleteProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.isBanned) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    await ProfileImage.deleteOne({
      user: user._id
    });

    user.avatar = '';
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile photo removed successfully.'
    });
  } catch (error) {
    console.error('[Profile Image Delete]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to remove profile photo.'
    });
  }
};
