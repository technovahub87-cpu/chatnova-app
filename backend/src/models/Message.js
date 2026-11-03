
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    senderCustomId: {
      type: String,
      required: true,
      trim: true,
    },

    senderName: {
      type: String,
      required: true,
      trim: true,
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    recipientCustomId: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        'text',
        'voice',
        'image',
        'video',
        'file',
        'gif',
        'sticker',
        'system'
      ],
      default: 'text',
    },

    content: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },

    voice: {
      duration: { type: Number, default: 0 },
      waveform: { type: [Number], default: [] },
      audioUrl: { type: String, trim: true },
    },

    media: {
      type: { type: String, trim: true },
      url: { type: String, trim: true },
      name: { type: String, trim: true },
      size: { type: String, trim: true },
      mimeType: { type: String, trim: true },
      duration: { type: Number, default: 0 },
      encryptedHash: { type: String, trim: true },
    },

    // Reply information
    replyTo: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
      },
      senderName: { type: String, trim: true, default: '' },
      content: { type: String, trim: true, default: '' },
      type: { type: String, trim: true, default: 'text' },
      mediaName: { type: String, trim: true, default: '' },
    },

    // Forward information
    forwardedFrom: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
      },
      senderName: { type: String, trim: true, default: '' },
      isForwarded: { type: Boolean, default: false },
    },

    // Delete for me
    deletedFor: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],

    // Delete for everyone
    deletedForEveryone: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    reactions: {
      type: Map,
      of: [String],
      default: {},
    },

    deliveredAt: {
      type: Date,
    },

    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ chatId: 1, deletedForEveryone: 1 });

module.exports =
  mongoose.models.Message || mongoose.model('Message', MessageSchema);
