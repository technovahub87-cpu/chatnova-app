
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const DevicePairing = require('../models/DevicePairing');
const Session = require('../models/Session');
const User = require('../models/User');

const PAIRING_EXPIRY_MS = 2 * 60 * 1000;
const LOGIN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const safeCompare = (first, second) => {
  const a = Buffer.from(String(first || ''), 'hex');
  const b = Buffer.from(String(second || ''), 'hex');

  return (
    a.length === b.length &&
    a.length > 0 &&
    crypto.timingSafeEqual(a, b)
  );
};

const getDeviceDetails = (userAgent = '') => {
  const ua = String(userAgent);

  let browser = 'Unknown Browser';
  let operatingSystem = 'Unknown OS';
  let deviceName = 'Unknown Device';

  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  if (/Android/i.test(ua)) {
    operatingSystem = 'Android';
    deviceName = 'Android Device';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    operatingSystem = 'iOS';
    deviceName = 'Apple Device';
  } else if (/Windows/i.test(ua)) {
    operatingSystem = 'Windows';
    deviceName = 'Windows Computer';
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    operatingSystem = 'macOS';
    deviceName = 'Mac Computer';
  } else if (/Linux/i.test(ua)) {
    operatingSystem = 'Linux';
    deviceName = 'Linux Computer';
  }

  return { browser, operatingSystem, deviceName };
};

// --------------------------------------------------
// CREATE QR CODE ON AN ALREADY LOGGED-IN DEVICE
// --------------------------------------------------

exports.createDevicePairing = async (req, res) => {
  try {
    if (!req.session || !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Please log in again before linking a device.'
      });
    }

    const pairCode = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PAIRING_EXPIRY_MS);

    const pairing = await DevicePairing.create({
      user: req.user._id,
      pairCodeHash: hashValue(pairCode),
      sourceSession: req.session._id,
      sourceTokenId: req.session.tokenId,
      expiresAt
    });

    const qrPayload = JSON.stringify({
      type: 'chatnova-device-pairing',
      version: 1,
      code: pairCode
    });

    const qrCode = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320
    });

    return res.status(201).json({
      success: true,
      message: 'Device pairing QR code created.',
      pairingId: pairing._id,
      qrCode,
      expiresAt
    });
  } catch (error) {
    console.error('[Create Device Pairing Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to create device pairing QR code.'
    });
  }
};

// --------------------------------------------------
// CLAIM QR CODE FROM THE DEVICE BEING LINKED
// --------------------------------------------------

exports.claimDevicePairing = async (req, res) => {
  try {
    const { pairCode } = req.body;

    if (
      typeof pairCode !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(pairCode)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device pairing QR code.'
      });
    }

    const claimSecret = crypto.randomBytes(32).toString('hex');
    const device = getDeviceDetails(req.headers['user-agent'] || '');

    const pairing = await DevicePairing.findOneAndUpdate(
      {
        pairCodeHash: hashValue(pairCode),
        status: 'pending',
        expiresAt: { $gt: new Date() }
      },
      {
        $set: {
          status: 'claimed',
          claimSecretHash: hashValue(claimSecret),
          targetDeviceName: device.deviceName,
          targetBrowser: device.browser,
          targetOperatingSystem: device.operatingSystem,
          targetUserAgent: String(
            req.headers['user-agent'] || ''
          ).slice(0, 500),
          targetIpAddress: req.ip || '',
          claimedAt: new Date()
        }
      },
      { new: true }
    );

    if (!pairing) {
      return res.status(404).json({
        success: false,
        message: 'QR code expired, already used, or invalid. Generate a new QR code.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device request sent. Approve it on your already logged-in device.',
      pairingId: pairing._id,
      claimSecret
    });
  } catch (error) {
    console.error('[Claim Device Pairing Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to claim this device pairing.'
    });
  }
};

// --------------------------------------------------
// CHECK PAIRING STATUS ON THE SOURCE DEVICE
// --------------------------------------------------

exports.getDevicePairingStatus = async (req, res) => {
  try {
    const pairing = await DevicePairing.findOne({
      _id: req.params.pairingId,
      user: req.user._id,
      sourceSession: req.session._id,
      sourceTokenId: req.session.tokenId,
      expiresAt: { $gt: new Date() }
    }).select('-pairCodeHash -claimSecretHash -sourceTokenId');

    if (!pairing) {
      return res.status(404).json({
        success: false,
        message: 'Pairing request not found or expired.'
      });
    }

    return res.status(200).json({
      success: true,
      pairing: {
        id: pairing._id,
        status: pairing.status,
        targetDeviceName: pairing.targetDeviceName,
        targetBrowser: pairing.targetBrowser,
        targetOperatingSystem: pairing.targetOperatingSystem,
        claimedAt: pairing.claimedAt,
        expiresAt: pairing.expiresAt
      }
    });
  } catch (error) {
    console.error('[Pairing Status Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to check pairing status.'
    });
  }
};

// --------------------------------------------------
// APPROVE REQUEST ON THE SOURCE DEVICE
// --------------------------------------------------

exports.approveDevicePairing = async (req, res) => {
  try {
    const pairing = await DevicePairing.findOneAndUpdate(
      {
        _id: req.params.pairingId,
        user: req.user._id,
        sourceSession: req.session._id,
        sourceTokenId: req.session.tokenId,
        status: 'claimed',
        expiresAt: { $gt: new Date() }
      },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date()
        }
      },
      { new: true }
    );

    if (!pairing) {
      return res.status(400).json({
        success: false,
        message: 'No valid device request is waiting for approval.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'New device approved successfully.'
    });
  } catch (error) {
    console.error('[Approve Device Pairing Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to approve this device.'
    });
  }
};

// --------------------------------------------------
// REJECT REQUEST ON THE SOURCE DEVICE
// --------------------------------------------------

exports.rejectDevicePairing = async (req, res) => {
  try {
    const pairing = await DevicePairing.findOneAndUpdate(
      {
        _id: req.params.pairingId,
        user: req.user._id,
        sourceSession: req.session._id,
        sourceTokenId: req.session.tokenId,
        status: { $in: ['pending', 'claimed'] }
      },
      {
        $set: { status: 'rejected' }
      },
      { new: true }
    );

    if (!pairing) {
      return res.status(404).json({
        success: false,
        message: 'Pairing request could not be rejected.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device pairing request rejected.'
    });
  } catch (error) {
    console.error('[Reject Device Pairing Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to reject this device request.'
    });
  }
};

// --------------------------------------------------
// COMPLETE PAIRING AND ISSUE LOGIN TOKEN
// --------------------------------------------------

exports.completeDevicePairing = async (req, res) => {
  try {
    const { pairingId, claimSecret } = req.body;

    if (
      !pairingId ||
      typeof claimSecret !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(claimSecret)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid pairing information is required.'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Authentication service is not configured.'
      });
    }

    const pairing = await DevicePairing.findOne({
      _id: pairingId,
      status: 'approved',
      expiresAt: { $gt: new Date() }
    }).select('+claimSecretHash');

    if (
      !pairing ||
      !safeCompare(pairing.claimSecretHash, hashValue(claimSecret))
    ) {
      return res.status(401).json({
        success: false,
        message: 'Pairing is not approved or the request has expired.'
      });
    }

    const user = await User.findById(pairing.user);

    if (
      !user ||
      user.isBanned ||
      !user.mobileVerified ||
      !user.authenticatorEnabled
    ) {
      return res.status(403).json({
        success: false,
        message: 'This account cannot link a new device.'
      });
    }

    const consumed = await DevicePairing.findOneAndUpdate(
      {
        _id: pairing._id,
        status: 'approved',
        expiresAt: { $gt: new Date() },
        claimSecretHash: hashValue(claimSecret)
      },
      {
        $set: {
          status: 'consumed',
          consumedAt: new Date()
        }
      },
      { new: true }
    );

    if (!consumed) {
      return res.status(409).json({
        success: false,
        message: 'This pairing request has already been used.'
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        tokenVersion: user.tokenVersion || 0
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const tokenId = hashValue(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOGIN_EXPIRY_MS);

    await Session.create({
      tokenId,
      user: user._id,
      deviceName: pairing.targetDeviceName,
      browser: pairing.targetBrowser,
      operatingSystem: pairing.targetOperatingSystem,
      ipAddress: pairing.targetIpAddress,
      userAgent: pairing.targetUserAgent,
      lastActiveAt: now,
      expiresAt
    });

    return res.status(200).json({
      success: true,
      message: 'Device linked successfully.',
      token,
      user: {
        id: user._id,
        customId: user.customId,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        publicKeyFingerprint: user.publicKeyFingerprint,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        authenticatorEnabled: user.authenticatorEnabled,
        mobileVerified: user.mobileVerified
      }
    });
  } catch (error) {
    console.error('[Complete Device Pairing Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to complete device linking. Please start again.'
    });
  }
};
