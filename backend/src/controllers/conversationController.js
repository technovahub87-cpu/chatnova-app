
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { isBlockedBetween } = require('../services/blockService');

const normalizeCustomId = (value) =>
  String(value || '').trim().toLowerCase().replace(/^@?/, '@');

const isValidCustomId = (value) =>
  /^@[a-z0-9_]{3,24}$/.test(value);

const getParticipantIds = (conversation) =>
  conversation.participants.map((user) => String(user._id || user));

const createDirectConversation = async (req, res) => {
  try {
    const targetCustomId = normalizeCustomId(req.body.customId);
    const currentUserId = String(req.user._id);

    if (!isValidCustomId(targetCustomId)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid ChatNova ID.'
      });
    }

    const targetUser = await User.findOne({
      customId: targetCustomId,
      mobileVerified: true,
      authenticatorEnabled: true,
      isBanned: false
    }).select('_id customId displayName avatar');

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Verified ChatNova user not found.'
      });
    }

    if (String(targetUser._id) === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot start a conversation with yourself.'
      });
    }
    if (await isBlockedBetween(req.user._id, targetUser._id)) {
  return res.status(403).json({
    success: false,
    message: 'You cannot start a conversation because one of these users has blocked the other.'
  });
}

    const sortedIds = [
      currentUserId,
      String(targetUser._id)
    ].sort();

    const directKey = sortedIds.join('_');

    let conversation = await Conversation.findOne({
      type: 'direct',
      directKey,
      isActive: true
    }).populate(
      'participants',
      'customId displayName avatar status lastSeen role'
    );

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          type: 'direct',
          participants: sortedIds,
          directKey,
          createdBy: req.user._id
        });
      } catch (error) {
        // Another request may have created the same conversation.
        if (error.code !== 11000) throw error;

        conversation = await Conversation.findOne({
          type: 'direct',
          directKey,
          isActive: true
        }).populate(
          'participants',
          'customId displayName avatar status lastSeen role'
        );
      }
    }

    if (!conversation) {
      return res.status(500).json({
        success: false,
        message: 'Unable to create conversation.'
      });
    }

    if (!conversation.populated('participants')) {
      await conversation.populate(
        'participants',
        'customId displayName avatar status lastSeen role'
      );
    }

    return res.status(200).json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error('[Create Direct Conversation]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to create conversation.'
    });
  }
};

const createGroupConversation = async (req, res) => {
  try {
    const groupName = String(req.body.groupName || '').trim();
    const requestedIds = req.body.customIds;

    if (!groupName || groupName.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required and must be under 80 characters.'
      });
    }

    if (!Array.isArray(requestedIds)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide group member ChatNova IDs.'
      });
    }

    const normalizedIds = [
      ...new Set(requestedIds.map(normalizeCustomId))
    ];

    if (normalizedIds.length < 1 || normalizedIds.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'A group must have 2 to 256 members, including you.'
      });
    }

    if (normalizedIds.some((id) => !isValidCustomId(id))) {
      return res.status(400).json({
        success: false,
        message: 'One or more ChatNova IDs are invalid.'
      });
    }

    const users = await User.find({
      customId: { $in: normalizedIds },
      mobileVerified: true,
      authenticatorEnabled: true,
      isBanned: false
    }).select('_id customId');

    if (users.length !== normalizedIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more members are unavailable or not fully verified.'
      });
    }

    const participantIds = [
      ...new Set([
        String(req.user._id),
        ...users.map((user) => String(user._id))
      ])
    ];

    if (participantIds.length > 256) {
      return res.status(400).json({
        success: false,
        message: 'A group cannot have more than 256 members.'
      });
    }

    const conversation = await Conversation.create({
      type: 'group',
      participants: participantIds,
      createdBy: req.user._id,
      admins: [req.user._id],
      groupName,
      groupDescription: String(req.body.groupDescription || '').trim().slice(0, 500)
    });

    await conversation.populate(
      'participants',
      'customId displayName avatar status lastSeen role'
    );

    return res.status(201).json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error('[Create Group Conversation]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to create group conversation.'
    });
  }
};

const getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true
    })
      .populate(
        'participants',
        'customId displayName avatar status lastSeen role'
      )
      .populate('lastMessage')
      .sort({ lastActivityAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      conversations
    });

  } catch (error) {
    console.error('[Get My Conversations]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to load conversations.'
    });
  }
};

const getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.'
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
      isActive: true
    })
      .populate(
        'participants',
        'customId displayName avatar status lastSeen role'
      )
      .populate('lastMessage');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied.'
      });
    }

    return res.status(200).json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error('[Get Conversation]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to load conversation.'
    });
  }
};
const leaveGroupConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: 'group',
      participants: req.user._id,
      isActive: true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not a member.'
      });
    }

    const userId = String(req.user._id);

    conversation.participants = conversation.participants.filter(
      (id) => String(id) !== userId
    );

    conversation.admins = conversation.admins.filter(
      (id) => String(id) !== userId
    );

    if (conversation.admins.length === 0 && conversation.participants.length > 0) {
      conversation.admins = [conversation.participants[0]];
    }

    if (conversation.participants.length === 0) {
      conversation.isActive = false;
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      message: 'You have left the group successfully.'
    });

  } catch (error) {
    console.error('[Leave Group]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to leave the group.'
    });
  }
};
module.exports = {
  createDirectConversation,
  createGroupConversation,
  getMyConversations,
  getConversationById,
  leaveGroupConversation
};
