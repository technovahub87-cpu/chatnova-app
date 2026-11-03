const mongoose = require('mongoose');

const CallSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },

    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ['voice', 'video'],
      required: true
    },

    status: {
      type: String,
      enum: [
        'ringing',
        'answered',
        'ended',
        'missed',
        'rejected',
        'failed'
      ],
      default: 'ringing',
      index: true
    },

    startedAt: {
      type: Date,
      default: Date.now
    },

    answeredAt: {
      type: Date,
      default: null
    },

    endedAt: {
      type: Date,
      default: null
    },

    duration: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

CallSchema.index({
  caller: 1,
  createdAt: -1
});

CallSchema.index({
  receiver: 1,
  createdAt: -1
});

CallSchema.index({
  conversation: 1,
  createdAt: -1
});

module.exports =
  mongoose.models.Call ||
  mongoose.model('Call', CallSchema);
