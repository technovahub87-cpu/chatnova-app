
const mongoose = require('mongoose');

const ProfileImageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    data: {
      type: Buffer,
      required: true
    },

    contentType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
      required: true
    },

    size: {
      type: Number,
      required: true,
      max: 2 * 1024 * 1024
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.ProfileImage ||
  mongoose.model('ProfileImage', ProfileImageSchema);
