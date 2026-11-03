
const mongoose = require('mongoose');

const StatusMediaSchema = new mongoose.Schema(
  {
    status: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Status',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    data: {
      type: Buffer,
      required: true
    },
    contentType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
    },
    size: {
      type: Number,
      required: true
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

module.exports =
  mongoose.models.StatusMedia ||
  mongoose.model('StatusMedia', StatusMediaSchema);
