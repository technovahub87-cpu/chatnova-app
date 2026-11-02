
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      100
    );

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.'
      });
    }

    // Only active members can read this conversation.
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
      isActive: true
    }).select('_id');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied.'
      });
    }

    const filter = {
      chatId: String(conversation._id)
    };

    if (req.query.before) {
      const beforeDate = new Date(req.query.before);

      if (Number.isNaN(beforeDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid message pagination date.'
        });
      }

      filter.createdAt = { $lt: beforeDate };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('sender', 'customId displayName avatar');

    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit).reverse();

    return res.status(200).json({
      success: true,
      messages: page,
      hasMore,
      nextBefore: hasMore && page.length
        ? page[0].createdAt
        : null
    });

  } catch (error) {
    console.error('[Get Messages]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load messages.'
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const content = String(req.body.content || '').trim();

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.'
      });
    }

    if (!content || content.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Message must contain 1 to 10000 characters.'
      });
    }

    // This endpoint currently accepts text messages only.
    const type = req.body.type || 'text';

    if (type !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Only text messages are currently supported.'
      });
    }

    // Verify active conversation membership before saving.
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
      isActive: true
    }).populate('participants', '_id customId');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied.'
      });
    }

    const otherParticipants = conversation.participants.filter(
      (participant) =>
        String(participant._id) !== String(req.user._id)
    );

    const recipient = conversation.type === 'direct'
      ? otherParticipants[0]
      : null;

    const message = await Message.create({
      chatId: String(conversation._id),
      sender: req.user._id,
      senderCustomId: req.user.customId,
      senderName: req.user.displayName,
      ...(recipient ? {
        recipient: recipient._id,
        recipientCustomId: recipient.customId
      } : {}),
      type: 'text',
      content,
      status: 'sent'
    });

    await Conversation.updateOne(
      {
        _id: conversation._id,
        participants: req.user._id,
        isActive: true
      },
      {
        $set: {
          lastMessage: message._id,
          lastActivityAt: message.createdAt
        }
      }
    );

    await message.populate(
      'sender',
      'customId displayName avatar'
    );

    // Notify connected members of the conversation.
    const io = req.app.get('io');

    if (io) {
      for (const participant of conversation.participants) {
        io.to(`user:${participant._id}`).emit(
          'chat:new_message',
          {
            conversationId: String(conversation._id),
            message
          }
        );
      }
    }

    return res.status(201).json({
      success: true,
      message
    });

  } catch (error) {
    console.error('[Send Message]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to send message.'
    });
  }
};

module.exports = {
  getMessages,
  sendMessage
};
