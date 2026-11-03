
const Status = require('../models/Status');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const PrivacySettings = require('../models/PrivacySettings');

const getContactIds = async (userId) => {
  const conversations = await Conversation.find({
    type: 'direct',
    participants: userId,
    isActive: true
  }).select('participants');

  const contactIds = new Set([String(userId)]);

  for (const conversation of conversations) {
    for (const participantId of conversation.participants) {
      contactIds.add(String(participantId));
    }
  }

  return contactIds;
};

const canViewStatus = (status, ownerPrivacy, viewerId, contactIds) => {
  const ownerId = String(status.user?._id || status.user);

  if (ownerId === String(viewerId)) return true;

  const globalVisibility = ownerPrivacy?.statusVisibility || 'contacts';
  const statusAudience = status.audience || 'contacts';
  const isContact = contactIds.has(ownerId);

  if (globalVisibility === 'nobody' || statusAudience === 'nobody') {
    return false;
  }

  if (
    (globalVisibility === 'contacts' || statusAudience === 'contacts') &&
    !isContact
  ) {
    return false;
  }

  return true;
};

const getStatuses = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const now = new Date();

    const contactIds = await getContactIds(currentUserId);

    const possibleStatuses = await Status.find({
      expiresAt: { $gt: now }
    })
      .populate('user', 'customId displayName avatar')
      .populate('viewers.user', 'customId displayName avatar')
      .sort({ createdAt: -1 });

    const ownerIds = [
      ...new Set(
        possibleStatuses.map(status =>
          String(status.user?._id || status.user)
        )
      )
    ];

    const privacySettings = await PrivacySettings.find({
      user: { $in: ownerIds }
    }).select('user statusVisibility');

    const privacyMap = new Map(
      privacySettings.map(setting => [
        String(setting.user),
        setting
      ])
    );

    const visibleStatuses = possibleStatuses.filter(status => {
      const ownerId = String(status.user?._id || status.user);
      const ownerPrivacy = privacyMap.get(ownerId);

      return canViewStatus(
        status,
        ownerPrivacy,
        currentUserId,
        contactIds
      );
    });

    return res.status(200).json({
      success: true,
      statuses: visibleStatuses
    });
  } catch (error) {
    console.error('[Get Statuses Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load statuses.'
    });
  }
};

const createStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('_id isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is unavailable.'
      });
    }

    const text = String(req.body?.text || '').trim();
    const type = req.body?.type || 'text';

    if (type !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Photo and video statuses will be enabled after secure media upload is added.'
      });
    }

    if (!text || text.length > 700) {
      return res.status(400).json({
        success: false,
        message: 'Status text must contain 1 to 700 characters.'
      });
    }

    let privacy = await PrivacySettings.findOne({
      user: user._id
    });

    if (!privacy) {
      privacy = await PrivacySettings.create({
        user: user._id
      });
    }

    const audience = privacy.statusVisibility || 'contacts';

    const status = await Status.create({
      user: user._id,
      type: 'text',
      text,
      audience,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    const populatedStatus = await Status.findById(status._id)
      .populate('user', 'customId displayName avatar');

    return res.status(201).json({
      success: true,
      message: 'Status posted successfully.',
      status: populatedStatus
    });
  } catch (error) {
    console.error('[Create Status Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to post status.'
    });
  }
};

const markStatusViewed = async (req, res) => {
  try {
    const status = await Status.findOne({
      _id: req.params.statusId,
      expiresAt: { $gt: new Date() }
    });

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found or expired.'
      });
    }

    if (String(status.user) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot view your own status as another viewer.'
      });
    }

    const [ownerPrivacy, contactIds] = await Promise.all([
      PrivacySettings.findOne({
        user: status.user
      }).select('statusVisibility'),
      getContactIds(req.user._id)
    ]);

    if (
      !canViewStatus(
        status,
        ownerPrivacy,
        req.user._id,
        contactIds
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to view this status.'
      });
    }

    const alreadyViewed = status.viewers.some(
      viewer => String(viewer.user) === String(req.user._id)
    );

    if (!alreadyViewed) {
      status.viewers.push({
        user: req.user._id,
        viewedAt: new Date()
      });

      await status.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Status view recorded.'
    });
  } catch (error) {
    console.error('[Mark Status Viewed Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to record status view.'
    });
  }
};

const deleteStatus = async (req, res) => {
  try {
    const status = await Status.findOneAndDelete({
      _id: req.params.statusId,
      user: req.user._id
    });

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found or you cannot delete it.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Status deleted successfully.'
    });
  } catch (error) {
    console.error('[Delete Status Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete status.'
    });
  }
};

const getStatusViewers = async (req, res) => {
  try {
    const status = await Status.findOne({
      _id: req.params.statusId,
      user: req.user._id,
      expiresAt: { $gt: new Date() }
    }).populate('viewers.user', 'customId displayName avatar');

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Your status was not found or has expired.'
      });
    }

    return res.status(200).json({
      success: true,
      viewers: status.viewers
    });
  } catch (error) {
    console.error('[Get Status Viewers Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load status viewers.'
    });
  }
};

module.exports = {
  getStatuses,
  createStatus,
  markStatusViewed,
  deleteStatus,
  getStatusViewers
};
