const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      required: true,
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
    },
    senderName: {
      type: String,
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    recipientCustomId: {
      type: String,
    },
    type: {
      type: String,
      enum: ['text', 'voice', 'image', 'file', 'system'],
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
      duration: Number,
      waveform: [Number],
      audioUrl: String,
    },
    media: {
      type: { type: String },
      url: String,
      name: String,
      size: String,
      encryptedHash: String,
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

// Compound index for fast timeline queries
MessageSchema.index({ chatId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
