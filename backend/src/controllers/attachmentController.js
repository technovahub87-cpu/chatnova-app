
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

const BLOCKED_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.com',
  '.scr', '.js', '.vbs', '.ps1', '.sh',
  '.php', '.html', '.htm', '.jar', '.apk'
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

const cleanFileName = (value) => {
  let name = String(value || 'attachment')
    .replace(/[\r\n"]/g, '')
    .split(/[\\/]/)
    .pop()
    .trim();

  try {
    name = decodeURIComponent(name);
  } catch {
    // Keep the original safe filename if decoding fails.
  }

  name = name.replace(/[^\w.\- ()]/g, '_').slice(0, 180);

  return name || 'attachment';
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
        message: 'Selected file is empty.'
      });
    }

    if (req.body.length > MAX_ATTACHMENT_SIZE) {
      return res.status(413).json({
        success: false,
        message: 'Attachment must be smaller than 25 MB.'
      });
    }

    const originalName = cleanFileName(
      req.headers['x-file-name']
    );

    const extension = (
      originalName.match(/\.[^.]+$/)?.[0] || ''
    ).toLowerCase();

    if (BLOCKED_EXTENSIONS.includes(extension)) {
      return res.status(415).json({
        success: false,
        message: 'This file type is not allowed.'
      });
    }

    const contentType = String(
      req.headers['content-type'] || 'application/octet-stream'
    ).split(';')[0].trim().toLowerCase();

    const isImage = contentType.startsWith('image/');

    if (isImage && !ALLOWED_IMAGE_TYPES.includes(contentType)) {
      return res.status(415).json({
        success: false,
        message: 'Use JPG, PNG, GIF or WEBP images.'
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

    const bucket = getAttachmentBucket();
    const fileId = new ObjectId();

    const uploadStream = bucket.openUploadStreamWithId(
      fileId,
      originalName,
      {
        contentType,
        metadata: {
          conversationId: String(conversation._id),
          senderId: String(userId),
          uploadedAt: new Date()
        }
      }
    );

    uploadedFileId = fileId;

    await new Promise((resolve, reject) => {
      uploadStream.once('finish', resolve);
      uploadStream.once('error', reject);
      uploadStream.end(req.body);
    });

    const mediaUrl = '/api/messages/attachment/' + fileId;

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
        type: isImage ? 'image' : 'file',
        content: isImage ? 'Image attachment' : 'File attachment',
        status: 'sent',
        media: {
          type: isImage ? 'image' : 'file',
          url: mediaUrl,
          name: originalName,
          size: String(req.body.length),
          mimeType: contentType
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
        io.to('user:' + participant._id).emit('chat:new_message', {
          conversationId: String(conversation._id),
          message
        });
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

    const mediaUrl = '/api/messages/attachment/' + fileId;

    const message = await Message.findOne({
      type: { $in: ['image', 'file'] },
      'media.url': mediaUrl
    }).select('chatId type media');

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
    const isImage = message.type === 'image';
    const contentType = isImage &&
      ALLOWED_IMAGE_TYPES.includes(file.contentType)
        ? file.contentType
        : 'application/octet-stream';

    const fileName = cleanFileName(message.media?.name || file.filename);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      (isImage ? 'inline' : 'attachment') +
        "; filename*=UTF-8''" + encodeURIComponent(fileName)
    );

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
    console.error('[Attachment Access Error]:', error.message);

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
