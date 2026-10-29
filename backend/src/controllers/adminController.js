const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Message = require('../models/Message');

// @desc    Get all registered users for Master Admin
// @route   GET /api/admin/users
// @access  Master Admin Protected
exports.getAllUsers = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;

    const query = {};
    if (search && typeof search === 'string') {
      query.$or = [
        { customId: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { publicKeyFingerprint: { $regex: search, $options: 'i' } },
      ];
    }

    if (status === 'banned') query.isBanned = true;
    if (status === 'active') query.isBanned = false;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      users,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Admin GetUsers Error]:', errorMsg);
    return res.status(500).json({ success: false, message: 'Server error retrieving identities.' });
  }
};

// @desc    Ban or Unban a user identity
// @route   PUT /api/admin/users/:id/ban
// @access  Master Admin Protected
exports.toggleBanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, reason } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'User ID required.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Identity not found.' });
    }

    user.isBanned = Boolean(isBanned);
    user.banReason = isBanned ? (reason || 'Violated terms / automated probe detection') : '';
    user.bannedAt = isBanned ? new Date() : null;
    await user.save();

    // Create Audit Log entry
    try {
      await AuditLog.create({
        action: isBanned ? 'USER_ACCOUNT_SUSPENDED' : 'USER_ACCOUNT_REINSTATED',
        targetUser: user.customId || 'unknown',
        actor: 'MASTER_ADMIN',
        ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        severity: isBanned ? 'critical' : 'medium',
        details: isBanned
          ? `Account suspended by Master Admin. Reason: ${user.banReason}`
          : 'Account reinstated by Master Admin.',
      });
    } catch (auditErr) {}

    // Notify connected Socket.io clients if socket instance attached to req.app
    const io = req.app.get('io');
    if (io) {
      if (user.currentSocketId && isBanned) {
        io.to(user.currentSocketId).emit('auth:force_disconnect', {
          message: 'Your identity session has been suspended by Master Administration.',
        });
      }
      io.emit('admin:user_status_changed', {
        userId: user._id,
        customId: user.customId,
        isBanned: user.isBanned,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Identity ${user.customId} ${isBanned ? 'suspended' : 'reinstated'} successfully.`,
      user,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Admin ToggleBan Error]:', errorMsg);
    return res.status(500).json({ success: false, message: 'Server error updating identity ban status.' });
  }
};

// @desc    Get system KPIs & threat statistics
// @route   GET /api/admin/stats
// @access  Master Admin Protected
exports.getSystemStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const onlineUsers = await User.countDocuments({ status: 'online' });
    const totalMessages = await Message.countDocuments();

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        bannedUsers,
        activeUsers: totalUsers - bannedUsers,
        onlineUsers,
        totalMessages,
        relayNode: 'Zürich Offshore Relay (KYBER-768 / AES-256-GCM)',
        latencyMs: 14,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving stats.' });
  }
};

// @desc    Get real-time security audit logs
// @route   GET /api/admin/audit-logs
// @access  Master Admin Protected
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving audit logs.' });
  }
};

// @desc    Broadcast administrative announcement
// @route   POST /api/admin/broadcast
// @access  Master Admin Protected
exports.broadcastAnnouncement = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Broadcast message content required.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('admin:broadcast', {
        message: message.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // Log the broadcast event
    try {
      await AuditLog.create({
        action: 'ADMIN_GLOBAL_BROADCAST',
        targetUser: 'GLOBAL_NETWORK',
        actor: 'MASTER_ADMIN',
        ipAddress: req.ip || '127.0.0.1',
        severity: 'high',
        details: `Dispatched network-wide broadcast: "${message.substring(0, 50)}..."`,
      });
    } catch (auditErr) {}

    return res.status(200).json({
      success: true,
      message: 'Global announcement broadcasted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error dispatching broadcast.' });
  }
};
