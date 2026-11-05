
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

// Fetch Metered ICE servers using the private backend environment variable.
const getTurnIceServers = async (req, res) => {
  try {
    const appName = String(process.env.METERED_APP_NAME || '')
      .trim();

    const apiKey = String(process.env.METERED_API_KEY || '')
      .trim();

    if (!appName || !apiKey) {
      return res.status(503).json({
        success: false,
        message: 'TURN service is not configured.'
      });
    }

    const url = new URL(
      `https://${appName}.metered.live/api/v1/turn/credentials`
    );

    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error(
        '[ChatNova TURN] Metered returned status:',
        response.status
      );

      return res.status(502).json({
        success: false,
        message: 'Unable to retrieve TURN server details.'
      });
    }

    const iceServers = await response.json();

    if (!Array.isArray(iceServers) || iceServers.length === 0) {
      return res.status(502).json({
        success: false,
        message: 'Metered returned an invalid ICE server list.'
      });
    }

    return res.status(200).json({
      success: true,
      iceServers
    });
  } catch (error) {
    console.error(
      '[ChatNova TURN Error]:',
      error instanceof Error ? error.message : String(error)
    );

    return res.status(502).json({
      success: false,
      message: 'TURN service is temporarily unavailable.'
    });
  }
};

module.exports = {
  getCallHistory,
  getTurnIceServers
};
