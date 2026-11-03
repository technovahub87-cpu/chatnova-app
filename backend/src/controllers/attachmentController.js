
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

const getAttachmentBucket = () => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('Database is not connected.');
  }

  return new GridFSBucket(db, {
    bucketName: 'chatnovaAttachments'
  });
};

const uploadAttachment = async (req, res) => {
  let uploadedFileId = null;

  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.'
      });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Attachment file is empty.'
      });
    }

    if (req.body.length > MAX_ATTACHMENT_SIZE) {
      return res.status(413).json({
        success: false,
        message: 'Attachment must be smaller than 25 MB.'
      });
    }

    const contentType = String(
      req.headers['content-type'] || ''
    ).split(';')[0].trim().toLowerCase();

    const messageType =
      req.headers['x-message-type'] === 'sticker'
        ? 'sticker'
        : ALLOWED_IMAGE_TYPES.includes(contentType)
          ? 'image'
          : 'file';

    if (
      messageType === 'sticker' &&
      contentType !== 'image/png'
    ) {
      return res.status(415).json({
        success: false,
        message: 'Custom stickers must be PNG images.'
      });
    }

    if (
      contentType.startsWith('image/') &&
      !ALLOWED_IMAGE_TYPES.includes(contentType)
    ) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported image format.'
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      isActive: true
    }).populate('participants', '_id customId');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or access denied.'
      });
    }

    const otherParticipants = conversation.participants.filter(
      participant => String(participant._id) !== String(userId)
    );

    const recipient = conversation.type === 'direct'
      ? otherParticipants[0]
      : null;

    let originalName = 'Attachment';

    try {
      originalName = decodeURIComponent(
        String(req.headers['x-file-name'] || 'Attachment')
      );
    } catch {
      originalName = 'Attachment';
    }

    originalName = originalName
      .replace(/[\/\\\x00-\x1f]/g, '_')
      .slice(0, 200);

    const bucket = getAttachmentBucket();
    const filename = 'attachment-' + Date.now() + '-' + new ObjectId();

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: contentType || 'application/octet-stream',
      metadata: {
        conversationId: String(conversation._id),
        senderId: String(userId),
        originalName,
        uploadedAt: new Date()
      }
    });

    uploadedFileId = uploadStream.id;

    await new Promise((resolve, reject) => {
      uploadStream.once('finish', resolve);
      uploadStream.once('error', reject);
      uploadStream.end(req.body);
    });

    const mediaUrl =
      '/api/messages/attachment/' + uploadedFileId;

    let message;

    try {
      message = await Message.create({
        chatId: String(conversation._id),
        sender: userId,
        senderCustomId: req.user.customId,
        senderName: req.user.displayName,
        ...(recipient ? {
          recipient: recipient._id,
          recipientCustomId: recipient.customId
        } : {}),
        type: messageType,
        content:
          messageType === 'sticker'
            ? 'Sticker'
            : messageType === 'image'
              ? 'Image attachment'
              : 'File attachment',
        status: 'sent',
        media: {
          type: messageType,
          url: mediaUrl,
          name: originalName,
          size: String(req.body.length),
          mimeType: contentType || 'application/octet-stream'
        }
      });
    } catch (error) {
      await bucket.delete(uploadedFileId).catch(() => {});
      uploadedFileId = null;
      throw error;
    }

    await Conversation.updateOne(
      {
        _id: conversation._id,
        participants: userId,
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
        io.to('user:' + participant._id).emit(
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
    console.error('[Attachment Upload Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to upload attachment.'
    });
  }
};

const streamAttachment = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attachment ID.'
      });
    }

    const attachmentUrl =
      '/api/messages/attachment/' + fileId;

    const message = await Message.findOne({
      'media.url': attachmentUrl
    }).select('chatId media');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found.'
      });
    }

    const conversation = await Conversation.findOne({
      _id: message.chatId,
      participants: userId,
      isActive: true
    }).select('_id');

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: 'You cannot access this attachment.'
      });
    }

    const bucket = getAttachmentBucket();

    const files = await bucket.find({
      _id: new ObjectId(fileId)
    }).limit(1).toArray();

    if (!files.length) {
      return res.status(404).json({
        success: false,
        message: 'Attachment file is unavailable.'
      });
    }

    const file = files[0];

    res.setHeader(
      'Content-Type',
      file.contentType || 'application/octet-stream'
    );
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const downloadStream = bucket.openDownloadStream(
      new ObjectId(fileId)
    );

    downloadStream.on('error', error => {
      console.error('[Attachment Stream Error]:', error.message);

      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('[Attachment Read Error]:', error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Unable to open attachment.'
      });
    }

    res.destroy(error);
  }
};

module.exports = {
  uploadAttachment,
  streamAttachment
};
