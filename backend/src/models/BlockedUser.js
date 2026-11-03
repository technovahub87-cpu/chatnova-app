const mongoose = require('mongoose');

const BlockedUserSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

BlockedUserSchema.index(
  { blocker: 1, blocked: 1 },
  { unique: true }
);

BlockedUserSchema.index({ blocked: 1, createdAt: -1 });

module.exports =
  mongoose.models.BlockedUser ||
  mongoose.model('BlockedUser', BlockedUserSchema);
