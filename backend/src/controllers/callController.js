const mongoose = require('mongoose');
const Call = require('../models/Call');
const Conversation = require('../models/Conversation');

const getCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const type = String(req.query.type || 'all').toLowerCase();

    if (!['all', 'voice', 'video'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid call history filter.'
      });
    }

    const filter = {
      $or: [
        { caller: userId },
        { receiver: userId }
      ]
    };

    if (type !== 'all') {
      filter.type = type;
    }

    const calls = await Call.find(filter)
      .populate('caller', 'customId displayName avatar')
      .populate('receiver', 'customId displayName avatar')
      .populate('conversation', 'type isActive')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const history = calls.map((call) => {
      const isOutgoing =
        String(call.caller?._id) === String(userId);

      return {
        id: String(call._id),
        conversationId: call.conversation
          ? String(call.conversation._id)
          : null,
        type: call.type,
        status: call.status,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        contact: isOutgoing ? call.receiver : call.caller,
        startedAt: call.startedAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        duration: call.duration || 0
      };
    });

    return res.status(200).json({
      success: true,
      calls: history
    });
  } catch (error) {
    console.error('[Call History Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load call history.'
    });
  }
};

module.exports = {
  getCallHistory
};
