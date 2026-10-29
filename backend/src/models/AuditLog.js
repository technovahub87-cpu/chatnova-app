const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    targetUser: {
      type: String,
      required: true,
      trim: true,
    },
    actor: {
      type: String,
      default: 'SYSTEM',
      trim: true,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
      trim: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    details: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
