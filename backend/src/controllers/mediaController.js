
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime'
];

const getMediaBucket = () => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('Database is not connected.');
  }

  return new GridFSBucket(db, {
    bucketName: 'chatnovaMedia'
  });
};

const uploadVideoMessage = async (req, res) => {
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
        message: 'Video file is empty.'
      });
    }

    if (req.body.length > MAX_VIDEO_SIZE) {
      return res.status(413).json({
        success: false,
        message: 'Video must be smaller than 50 MB.'
      });
    }

    const contentType = String(
      req.headers['content-type'] || ''
    ).split(';')[0].trim().toLowerCase();

    if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported video format. Use MP4 or WebM.'
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

    const bucket = getMediaBucket();
    const filename = 'video-' + Date.now() + '-' + new ObjectId();

    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: {
        conversationId: String(conversation._id),
        senderId: String(userId),
        uploadedAt: new Date()
      }
    });

    uploadedFileId = uploadStream.id;

    await new Promise((resolve, reject) => {
      uploadStream.once('finish', resolve);
      uploadStream.once('error', reject);
      uploadStream.end(req.body);
    });

    const mediaUrl = '/api/messages/media/' + uploadedFileId;

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
        type: 'video',
        content: 'Video message',
        status: 'sent',
        media: {
          type: 'video',
          url: mediaUrl,
          name: String(req.headers['x-file-name'] || 'Video').slice(0, 200),
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

    await message.populate('sender', 'customId displayName avatar');

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
    console.error('[Video Upload Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to upload video message.'
    });
  }
};

const streamMediaFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media file ID.'
      });
    }

    const mediaUrl = '/api/messages/media/' + fileId;

    const message = await Message.findOne({
      type: 'video',
      'media.url': mediaUrl
    }).select('chatId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Video message not found.'
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
        message: 'You cannot access this video.'
      });
    }

    const bucket = getMediaBucket();

    const files = await bucket.find({
      _id: new ObjectId(fileId)
    }).limit(1).toArray();

    if (!files.length) {
      return res.status(404).json({
        success: false,
        message: 'Video file is unavailable.'
      });
    }

    const file = files[0];

    res.setHeader('Content-Type', file.contentType || 'video/mp4');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');

    const downloadStream = bucket.openDownloadStream(
      new ObjectId(fileId)
    );

    downloadStream.on('error', error => {
      console.error('[Media Stream Error]:', error.message);

      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('[Media Playback Error]:', error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Unable to play video.'
      });
    }

    res.destroy(error);
  }
};

module.exports = {
  uploadVideoMessage,
  streamMediaFile
};
