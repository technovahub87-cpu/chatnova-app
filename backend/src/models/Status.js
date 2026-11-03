
const mongoose = require('mongoose');

const StatusViewerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const StatusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ['text', 'image', 'video'],
      required: true,
      default: 'text'
    },

    text: {
      type: String,
      trim: true,
      maxlength: 700,
      default: ''
    },

    mediaUrl: {
      type: String,
      trim: true,
      default: ''
    },

    caption: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
    },

    audience: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'contacts',
      index: true
    },

    viewers: {
      type: [StatusViewerSchema],
      default: []
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    }
  },
  {
    timestamps: true
  }
);

StatusSchema.index({ user: 1, createdAt: -1 });
StatusSchema.index({ expiresAt: 1 });

module.exports =
  mongoose.models.Status ||
  mongoose.model('Status', StatusSchema);
