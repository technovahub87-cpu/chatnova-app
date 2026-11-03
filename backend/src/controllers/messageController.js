
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
    const type = req.body.type || 'text';

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.'
      });
    }

    const allowedTypes = ['text', 'gif', 'sticker'];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported message type.'
      });
    }

    let content = String(req.body.content || '').trim();
    let media = undefined;

    if (type === 'text') {
      if (!content || content.length > 10000) {
        return res.status(400).json({
          success: false,
          message: 'Message must contain 1 to 10000 characters.'
        });
      }
    } else {
      const suppliedUrl = String(req.body.media?.url || '').trim();

      let parsedUrl;

      try {
        parsedUrl = new URL(suppliedUrl);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid GIF or sticker URL.'
        });
      }

      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({
          success: false,
          message: 'GIF and sticker links must use HTTPS.'
        });
      }

      if (suppliedUrl.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Media URL is too long.'
        });
      }

      const allowedMediaHosts = [
        'media.tenor.com',
        'tenor.com',
        'giphy.com',
        'media.giphy.com',
        'i.giphy.com'
      ];

      const hostAllowed = allowedMediaHosts.some(host =>
        parsedUrl.hostname === host ||
        parsedUrl.hostname.endsWith('.' + host)
      );

      if (!hostAllowed) {
        return res.status(400).json({
          success: false,
          message: 'This GIF or sticker provider is not supported.'
        });
      }

      content = type === 'gif' ? 'GIF attachment' : 'Sticker';

      media = {
        type: type,
        url: suppliedUrl,
        name: String(req.body.media?.name || type).slice(0, 180),
        size: '0',
        mimeType: 'image/gif'
      };
    }

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
      participant =>
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
      type,
      content,
      ...(media ? { media } : {}),
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

// Mark messages received by the logged-in user as read.
const markMessagesRead = async (req, res) => {
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
      isActive: true,
      type: 'direct'
    }).select('_id');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Direct conversation not found or access denied.'
      });
    }

    const filter = {
      chatId: String(conversation._id),
      recipient: req.user._id,
      status: { $ne: 'read' }
    };

    const unreadMessages = await Message.find(filter)
      .select('_id sender')
      .lean();

    if (unreadMessages.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No unread messages.',
        readMessageIds: []
      });
    }

    const readAt = new Date();

    await Message.updateMany(
      filter,
      {
        $set: {
          status: 'read',
          readAt
        }
      }
    );

    const readMessageIds = unreadMessages.map(
      message => String(message._id)
    );

    const io = req.app.get('io');

    if (io) {
      const senderIds = [
        ...new Set(
          unreadMessages.map(message => String(message.sender))
        )
      ];

      senderIds.forEach(senderId => {
        io.to(`user:${senderId}`).emit(
          'chat:message_status',
          {
            conversationId: String(conversation._id),
            messageIds: readMessageIds,
            status: 'read',
            readAt
          }
        );
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read.',
      readMessageIds,
      readAt
    });

  } catch (error) {
    console.error('[Mark Messages Read]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to mark messages as read.'
    });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  markMessagesRead
};
