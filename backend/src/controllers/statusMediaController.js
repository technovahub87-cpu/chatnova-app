
const mongoose = require('mongoose');
const Status = require('../models/Status');
const StatusMedia = require('../models/StatusMedia');
const User = require('../models/User');
const PrivacySettings = require('../models/PrivacySettings');
const Conversation = require('../models/Conversation');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 10 * 1024 * 1024;

const MEDIA_TYPES = {
  'image/jpeg': {
    maxSize: MAX_IMAGE_SIZE,
    validate: buffer =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
  },
  'image/png': {
    maxSize: MAX_IMAGE_SIZE,
    validate: buffer =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      )
  },
  'image/webp': {
    maxSize: MAX_IMAGE_SIZE,
    validate: buffer =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
  },
  'video/mp4': {
    maxSize: MAX_VIDEO_SIZE,
    validate: buffer =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 4, 8) === 'ftyp'
  },
  'video/webm': {
    maxSize: MAX_VIDEO_SIZE,
    validate: buffer =>
      buffer.length >= 4 &&
      buffer.subarray(0, 4).equals(
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
      )
  }
};

exports.createMediaStatus = async (req, res) => {
  let createdStatus = null;

  try {
    const user = await User.findById(req.user._id).select('_id isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is unavailable.'
      });
    }

    const { dataUrl, caption = '' } = req.body || {};

    if (typeof dataUrl !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please select a photo or video.'
      });
    }

    const match = dataUrl.match(
      /^data:(image\/jpeg|image\/png|image\/webp|video\/mp4|video\/webm);base64,([A-Za-z0-9+/]+={0,2})$/
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'This photo or video format is not supported.'
      });
    }

    const contentType = match[1];
    const base64 = match[2];
    const mediaConfig = MEDIA_TYPES[contentType];
    const buffer = Buffer.from(base64, 'base64');

    if (
      buffer.length === 0 ||
      buffer.length > mediaConfig.maxSize ||
      buffer.toString('base64').replace(/=+$/, '') !==
        base64.replace(/=+$/, '')
    ) {
      return res.status(400).json({
        success: false,
        message: contentType.startsWith('image/')
          ? 'Photo size must be 5 MB or smaller.'
          : 'Video size must be 10 MB or smaller.'
      });
    }

    if (!mediaConfig.validate(buffer)) {
      return res.status(400).json({
        success: false,
        message: 'The selected file is invalid.'
      });
    }

    const cleanCaption = String(caption).trim();

    if (cleanCaption.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Caption cannot exceed 200 characters.'
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

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const type = contentType.startsWith('image/') ? 'image' : 'video';

    createdStatus = await Status.create({
      user: user._id,
      type,
      text: '',
      caption: cleanCaption,
      audience: privacy.statusVisibility || 'contacts',
      expiresAt
    });

    await StatusMedia.create({
      status: createdStatus._id,
      user: user._id,
      data: buffer,
      contentType,
      size: buffer.length,
      expiresAt
    });

    createdStatus.mediaUrl =
      `/api/auth/statuses/${createdStatus._id}/media`;

    await createdStatus.save();

    const populatedStatus = await Status.findById(createdStatus._id)
      .populate('user', 'customId displayName avatar');

    return res.status(201).json({
      success: true,
      message: 'Media status posted successfully.',
      status: populatedStatus
    });
  } catch (error) {
    if (createdStatus) {
      await Promise.all([
        Status.deleteOne({ _id: createdStatus._id }),
        StatusMedia.deleteOne({ status: createdStatus._id })
      ]).catch(() => {});
    }

    console.error('[Create Media Status Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to post media status.'
    });
  }
};

exports.getStatusMedia = async (req, res) => {
  try {
    const { statusId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(statusId)) {
      return res.status(404).end();
    }

    const status = await Status.findOne({
      _id: statusId,
      expiresAt: { $gt: new Date() }
    });

    if (!status) {
      return res.status(404).end();
    }

    const ownerId = String(status.user);
    const viewerId = String(req.user._id);

    if (ownerId !== viewerId) {
      const [ownerPrivacy, conversations] = await Promise.all([
        PrivacySettings.findOne({ user: status.user }).select('statusVisibility'),
        Conversation.find({
          type: 'direct',
          participants: req.user._id,
          isActive: true
        }).select('participants')
      ]);

      const isContact = conversations.some(conversation =>
        conversation.participants.some(
          participant => String(participant) === ownerId
        )
      );

      const globalVisibility = ownerPrivacy?.statusVisibility || 'contacts';
      const audience = status.audience || 'contacts';

      if (
        globalVisibility === 'nobody' ||
        audience === 'nobody' ||
        ((globalVisibility === 'contacts' || audience === 'contacts') &&
          !isContact)
      ) {
        return res.status(403).end();
      }
    }

    const media = await StatusMedia.findOne({
      status: status._id,
      expiresAt: { $gt: new Date() }
    });

    if (!media || !media.data) {
      return res.status(404).end();
    }

    res.set({
      'Content-Type': media.contentType,
      'Content-Length': String(media.size),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin'
    });

    return res.status(200).send(media.data);
  } catch (error) {
    console.error('[Get Status Media Error]:', error.message);
    return res.status(500).end();
  }
};
