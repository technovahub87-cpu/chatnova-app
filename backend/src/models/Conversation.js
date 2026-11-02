
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

    // Only verified database User IDs are stored here.
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],

    // Unique deterministic key for one-to-one conversations.
    // Example: smallerUserId_largerUserId
    directKey: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
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

    // Only these members can manage group settings.
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

// Every conversation must have at least two members.
ConversationSchema.pre('validate', function (next) {
  if (!Array.isArray(this.participants) || this.participants.length < 2) {
    return next(new Error('A conversation requires at least two participants.'));
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

  next();
});

// Efficiently find conversations belonging to a user.
ConversationSchema.index({
  participants: 1,
  lastActivityAt: -1
});

// Efficiently check membership and load recent conversations.
ConversationSchema.index({
  _id: 1,
  participants: 1,
  isActive: 1
});

module.exports =
  mongoose.models.Conversation ||
  mongoose.model('Conversation', ConversationSchema);
