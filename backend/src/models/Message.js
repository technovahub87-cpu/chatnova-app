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
      duration: { type: Number, default: 0 },
      waveform: { type: [Number], default: [] },
      audioUrl: { type: String, trim: true },
    },
    media: {
      type: { type: String, trim: true },
      url: { type: String, trim: true },
      name: { type: String, trim: true },
      size: { type: String, trim: true },
      encryptedHash: { type: String, trim: true },
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

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
