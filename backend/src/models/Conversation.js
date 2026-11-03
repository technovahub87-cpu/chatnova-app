
const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
      default: 'direct',
      index: true
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],

    directKey: {
      type: String,
      trim: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    groupName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: ''
    },

    groupDescription: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },

    groupIcon: {
      type: String,
      trim: true,
      default: ''
    },

    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

ConversationSchema.pre('validate', function (next) {
  if (!Array.isArray(this.participants) || this.participants.length < 1) {
  return next(new Error('A conversation requires at least one participant.'));
}

if (this.type === 'direct' && this.participants.length !== 2) {
  return next(new Error('A direct conversation must have exactly two participants.'));
}
  const participantIds = this.participants.map((id) => String(id));
  const uniqueIds = new Set(participantIds);

  if (uniqueIds.size !== participantIds.length) {
    return next(new Error('Duplicate conversation participants are not allowed.'));
  }

  if (this.type === 'direct' && participantIds.length !== 2) {
    return next(new Error('A direct conversation must have exactly two participants.'));
  }

  if (this.type === 'group' && participantIds.length > 256) {
    return next(new Error('A group cannot have more than 256 participants.'));
  }

  if (this.type === 'group' && !this.groupName) {
    return next(new Error('A group name is required.'));
  }

  if (this.type === 'direct' && !this.directKey) {
    return next(new Error('A direct conversation requires a direct key.'));
  }

  if (this.type === 'group' && this.directKey) {
    return next(new Error('A group conversation cannot have a direct key.'));
  }

  next();
});

ConversationSchema.index(
  { directKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      directKey: { $type: 'string' }
    }
  }
);

ConversationSchema.index({
  participants: 1,
  lastActivityAt: -1
});

ConversationSchema.index({
  _id: 1,
  participants: 1,
  isActive: 1
});

module.exports =
  mongoose.models.Conversation ||
  mongoose.model('Conversation', ConversationSchema);
