
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const getConversationForUser = async (conversationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
    isActive: true
  }).populate('participants', '_id customId');
};

const getRecipient = (conversation, userId) => {
  if (conversation.type !== 'direct') return null;

  return conversation.participants.find(
    participant => String(participant._id) !== String(userId)
  ) || null;
};

const emitMessage = (io, conversation, message) => {
  if (!io) return;

  for (const participant of conversation.participants) {
    io.to(`user:${participant._id}`).emit('chat:new_message', {
      conversationId: String(conversation._id),
      message
    });
  }
};

const messageAction = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { action, targetConversationId } = req.body || {};
    const userId = req.user._id;

    if (
      !mongoose.Types.ObjectId.isValid(conversationId) ||
      !mongoose.Types.ObjectId.isValid(messageId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation or message ID.'
      });
    }

    const conversation = await getConversationForUser(
      conversationId,
      userId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied.'
      });
    }

    const original = await Message.findOne({
      _id: messageId,
      chatId: String(conversation._id)
    });

    if (!original) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }

    const io = req.app.get('io');

    // Delete only from the current user's view.
    if (action === 'delete_for_me') {
      await Message.updateOne(
        { _id: original._id },
        { $addToSet: { deletedFor: userId } }
      );

      if (io) {
        io.to(`user:${userId}`).emit('chat:message_deleted', {
          conversationId: String(conversation._id),
          messageId: String(original._id),
          scope: 'me',
          userId: String(userId)
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Message deleted for you.'
      });
    }

    // Delete for everyone is allowed only to the original sender.
    if (action === 'delete_for_everyone') {
      if (String(original.sender) !== String(userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can delete only your own message for everyone.'
        });
      }

      await Message.updateOne(
        { _id: original._id },
        {
          $set: {
            deletedForEveryone: true,
            deletedAt: new Date(),
            content: 'This message was deleted.',
            media: undefined,
            voice: undefined
          }
        }
      );

      if (io) {
        for (const participant of conversation.participants) {
          io.to(`user:${participant._id}`).emit('chat:message_deleted', {
            conversationId: String(conversation._id),
            messageId: String(original._id),
            scope: 'everyone'
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Message deleted for everyone.'
      });
    }

    if (original.deletedForEveryone) {
      return res.status(400).json({
        success: false,
        message: 'This message has already been deleted.'
      });
    }

    if ((original.deletedFor || []).some(
      id => String(id) === String(userId)
    )) {
      return res.status(404).json({
        success: false,
        message: 'This message is not available in your chat.'
      });
    }

    // Reply: create a new message containing a reference to the original.
    if (action === 'reply') {
      const replyContent = String(req.body.content || '').trim();

      if (!replyContent || replyContent.length > 10000) {
        return res.status(400).json({
          success: false,
          message: 'Enter a reply of up to 10000 characters.'
        });
      }

      const recipient = getRecipient(conversation, userId);

      const reply = await Message.create({
        chatId: String(conversation._id),
        sender: userId,
        senderCustomId: req.user.customId,
        senderName: req.user.displayName,
        ...(recipient ? {
          recipient: recipient._id,
          recipientCustomId: recipient.customId
        } : {}),
        type: 'text',
        content: replyContent,
        replyTo: {
          messageId: original._id,
          senderName: original.senderName || '',
          content: original.deletedForEveryone
            ? 'This message was deleted.'
            : String(original.content || ''),
          type: original.type || 'text',
          mediaName: original.media?.name || ''
        },
        status: 'sent'
      });

      await Conversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessage: reply._id,
            lastActivityAt: reply.createdAt
          }
        }
      );

      await reply.populate('sender', 'customId displayName avatar');
      emitMessage(io, conversation, reply);

      return res.status(201).json({
        success: true,
        message: reply
      });
    }

    // Forward: copy the message into another conversation.
    if (action === 'forward') {
      if (!targetConversationId) {
        return res.status(400).json({
          success: false,
          message: 'Choose a destination conversation.'
        });
      }

      const targetConversation = await getConversationForUser(
        targetConversationId,
        userId
      );

      if (!targetConversation) {
        return res.status(404).json({
          success: false,
          message: 'Destination conversation not found or access denied.'
        });
      }

      const recipient = getRecipient(targetConversation, userId);

      const forwarded = await Message.create({
        chatId: String(targetConversation._id),
        sender: userId,
        senderCustomId: req.user.customId,
        senderName: req.user.displayName,
        ...(recipient ? {
          recipient: recipient._id,
          recipientCustomId: recipient.customId
        } : {}),
        type: original.type,
        content: original.content,
        ...(original.media ? {
          media: original.media.toObject
            ? original.media.toObject()
            : original.media
        } : {}),
        ...(original.voice ? {
          voice: original.voice.toObject
            ? original.voice.toObject()
            : original.voice
        } : {}),
        forwardedFrom: {
          messageId: original._id,
          senderName: original.senderName || '',
          isForwarded: true
        },
        status: 'sent'
      });

      await Conversation.updateOne(
        { _id: targetConversation._id },
        {
          $set: {
            lastMessage: forwarded._id,
            lastActivityAt: forwarded.createdAt
          }
        }
      );

      await forwarded.populate('sender', 'customId displayName avatar');
      emitMessage(io, targetConversation, forwarded);

      return res.status(201).json({
        success: true,
        message: forwarded
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Unsupported message action.'
    });

  } catch (error) {
    console.error('[Message Action Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to complete this message action.'
    });
  }
};

module.exports = {
  messageAction
};
