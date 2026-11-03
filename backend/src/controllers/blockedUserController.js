const mongoose = require('mongoose');
const User = require('../models/User');
const BlockedUser = require('../models/BlockedUser');

// Get all users blocked by the logged-in user
exports.listBlockedUsers = async (req, res) => {
  try {
    const blockedUsers = await BlockedUser.find({
      blocker: req.user._id
    })
      .populate('blocked', 'customId displayName avatar bio')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      blockedUsers: blockedUsers
        .filter(item => item.blocked)
        .map(item => ({
          blockId: item._id,
          user: item.blocked,
          blockedAt: item.createdAt
        }))
    });
  } catch (error) {
    console.error('List blocked users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load blocked users.'
    });
  }
};

// Block a user using their ChatNova ID
exports.blockUser = async (req, res) => {
  try {
    const customId = String(req.body.customId || '')
      .trim()
      .toLowerCase();

    if (!customId) {
      return res.status(400).json({
        success: false,
        message: 'ChatNova ID is required.'
      });
    }

    if (customId === String(req.user.customId).toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself.'
      });
    }

    const targetUser = await User.findOne({
      customId,
      mobileVerified: true,
      isBanned: false
    }).select('_id customId displayName avatar');

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found or unavailable.'
      });
    }

    const existingBlock = await BlockedUser.findOne({
      blocker: req.user._id,
      blocked: targetUser._id
    });

    if (existingBlock) {
      return res.status(200).json({
        success: true,
        message: 'This user is already blocked.'
      });
    }

    await BlockedUser.create({
      blocker: req.user._id,
      blocked: targetUser._id
    });

    return res.status(201).json({
      success: true,
      message: 'User blocked successfully.',
      blockedUser: targetUser
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: 'This user is already blocked.'
      });
    }

    console.error('Block user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to block this user.'
    });
  }
};

// Unblock a user using their BlockedUser record ID
exports.unblockUser = async (req, res) => {
  try {
    const { blockedUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blockedUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blocked user ID.'
      });
    }

    const result = await BlockedUser.findOneAndDelete({
      _id: blockedUserId,
      blocker: req.user._id
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Blocked user record not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User unblocked successfully.'
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to unblock this user.'
    });
  }
};
