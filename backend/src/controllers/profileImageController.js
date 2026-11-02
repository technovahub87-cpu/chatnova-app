const mongoose = require('mongoose');
const ProfileImage = require('../models/ProfileImage');
const User = require('../models/User');

const MAX_SIZE = 2 * 1024 * 1024;

const IMAGE_TYPES = {
  'image/jpeg': (b) =>
    b.length >= 3 &&
    b[0] === 0xff &&
    b[1] === 0xd8 &&
    b[2] === 0xff,

  'image/png': (b) =>
    b.length >= 8 &&
    b.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    ),

  'image/webp': (b) =>
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
};

exports.uploadProfileImage = async (req, res) => {
  try {
    const { dataUrl } = req.body || {};

    if (typeof dataUrl !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please select a profile photo.'
      });
    }

    const match = dataUrl.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Only JPG, PNG and WEBP images are allowed.'
      });
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    if (
      buffer.length === 0 ||
      buffer.length > MAX_SIZE ||
      buffer.toString('base64').replace(/=+$/, '') !==
        match[2].replace(/=+$/, '')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Profile photo must be valid and 2 MB or smaller.'
      });
    }

    if (!IMAGE_TYPES[contentType](buffer)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image file.'
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
        data: buffer,
        contentType,
        size: buffer.length
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    const avatarUrl =
      `/api/auth/profile-image/${user._id}?v=${Date.now()}`;

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

exports.getProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).end();
    }

    // Use a Mongoose document so the image data is returned as a Buffer.
    const image = await ProfileImage.findOne({ user: userId });

    if (!image || !image.data) {
      return res.status(404).end();
    }

    const imageBuffer = Buffer.isBuffer(image.data)
      ? image.data
      : Buffer.from(image.data);

    res.set({
      'Content-Type': image.contentType,
      'Content-Length': String(imageBuffer.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });

    return res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('[Profile Image Read]:', error.message);
    return res.status(500).end();
  }
};

exports.deleteProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.isBanned) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    await ProfileImage.deleteOne({ user: user._id });

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
