
const Session = require('../models/Session');

exports.getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      user: req.user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    })
      .select(
        'tokenId deviceName browser operatingSystem lastActiveAt createdAt'
      )
      .sort({ lastActiveAt: -1 })
      .lean();

    const safeSessions = sessions.map((session) => ({
      _id: session._id,
      deviceName: session.deviceName,
      browser: session.browser,
      operatingSystem: session.operatingSystem,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: Boolean(
        req.session &&
        req.session.tokenId === session.tokenId
      )
    }));

    return res.status(200).json({
      success: true,
      sessions: safeSessions
    });
  } catch (error) {
    console.error('[Get Sessions Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load linked devices.'
    });
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      user: req.user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Linked device session was not found.'
      });
    }

    if (
      req.session &&
      req.session.tokenId === session.tokenId
    ) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove the device you are currently using.'
      });
    }

    session.revokedAt = new Date();
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Device session revoked successfully.'
    });
  } catch (error) {
    console.error('[Revoke Session Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to remove this linked device.'
    });
  }
};
