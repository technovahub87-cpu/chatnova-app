
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/aac'
];

const getAudioBucket = () => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('Database is not connected.');
  }

  return new GridFSBucket(db, {
    bucketName: 'chatnovaAudio'
  });
};

const uploadVoiceMessage = async (req, res) => {
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
        message: 'Audio recording is empty.'
      });
    }

    if (req.body.length > MAX_AUDIO_SIZE) {
      return res.status(413).json({
        success: false,
        message: 'Voice message must be smaller than 10 MB.'
      });
    }

    const contentType = String(
      req.headers['content-type'] || ''
    ).split(';')[0].trim().toLowerCase();

    if (!ALLOWED_AUDIO_TYPES.includes(contentType)) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported audio format.'
      });
    }

    const duration = Number(req.headers['x-audio-duration']);

    if (
      !Number.isFinite(duration) ||
      duration < 1 ||
      duration > 300
    ) {
      return res.status(400).json({
        success: false,
        message: 'Voice message duration must be between 1 and 300 seconds.'
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
      (participant) =>
        String(participant._id) !== String(userId)
    );

    const recipient = conversation.type === 'direct'
      ? otherParticipants[0]
      : null;

    const bucket = getAudioBucket();

    const filename = `voice-${Date.now()}-${new ObjectId()}`;

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

    const audioUrl = `/api/messages/voice/${uploadedFileId}`;

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
        type: 'voice',
        content: 'Voice message',
        status: 'sent',
        voice: {
          duration: Math.round(duration),
          waveform: [],
          audioUrl
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
    console.error('[Voice Upload Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to upload voice message.'
    });
  }
};

const streamVoiceMessage = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audio file ID.'
      });
    }

    const audioUrl = `/api/messages/voice/${fileId}`;

    const message = await Message.findOne({
      type: 'voice',
      'voice.audioUrl': audioUrl
    }).select('chatId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Voice message not found.'
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
        message: 'You cannot access this voice message.'
      });
    }

    const bucket = getAudioBucket();
    const files = await bucket.find({
      _id: new ObjectId(fileId)
    }).limit(1).toArray();

    if (!files.length) {
      return res.status(404).json({
        success: false,
        message: 'Audio file is unavailable.'
      });
    }

    const file = files[0];
    const contentType = ALLOWED_AUDIO_TYPES.includes(
      file.contentType
    ) ? file.contentType : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const downloadStream = bucket.openDownloadStream(
      new ObjectId(fileId)
    );

    downloadStream.on('error', (error) => {
      console.error('[Voice Stream Error]:', error.message);

      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('[Voice Playback Error]:', error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Unable to play voice message.'
      });
    }

    res.destroy(error);
  }
};

module.exports = {
  uploadVoiceMessage,
  streamVoiceMessage
};
