const crypto = require('crypto');
const speakeasy = require('speakeasy');
const User = require('../models/User');

const getEncryptionKey = () => {
  const key = process.env.AUTH_ENCRYPTION_KEY;
  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error('Encryption key is not configured correctly.');
  }
  return Buffer.from(key, 'hex');
};

const decryptSecret = (value) => {
  const parts = String(value || '').split(':');
  if (parts.length !== 3) throw new Error('Invalid authenticator secret.');

  const [iv, tag, encrypted] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final()
  ]).toString('utf8');
};

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const safeCompare = (first, second) => {
  const a = Buffer.from(String(first || ''), 'hex');
  const b = Buffer.from(String(second || ''), 'hex');

  return a.length === b.length &&
    a.length > 0 &&
    crypto.timingSafeEqual(a, b);
};

const verifyAuthenticatorCode = (user, code) => {
  if (!user.authenticatorSecretEncrypted) return false;

  const secret = decryptSecret(user.authenticatorSecretEncrypted);

  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(code || '').replace(/\s/g, ''),
    window: 1
  });
};

const consumeRecoveryCode = (user, code) => {
  const enteredHash = hashValue(String(code || '').trim().toUpperCase());
  const codes = user.recoveryCodesHash || [];

  const index = codes.findIndex(saved => safeCompare(saved, enteredHash));

  if (index === -1) return false;

  codes.splice(index, 1);
  user.recoveryCodesHash = codes;
  return true;
};

exports.changePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
      authenticatorCode,
      recoveryCode
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    if (String(newPassword).length < 8 || String(newPassword).length > 128) {
      return res.status(400).json({
        success: false,
        message: 'New password must contain 8 to 128 characters.'
      });
    }

    if (String(currentPassword) === String(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from the current password.'
      });
    }

    const user = await User.findById(req.user._id)
      .select('+password +authenticatorSecretEncrypted +recoveryCodesHash');

    if (!user || !user.mobileVerified || !user.authenticatorEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Verified Authenticator App is required.'
      });
    }

    const passwordMatches = await user.comparePassword(currentPassword);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    let verified = false;

    if (authenticatorCode) {
      verified = verifyAuthenticatorCode(user, authenticatorCode);
    } else if (recoveryCode) {
      verified = consumeRecoveryCode(user, recoveryCode);
    }

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: 'Enter a valid Authenticator code or unused Recovery Code.'
      });
    }

    user.password = String(newPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed. All devices have been signed out. Please log in again.'
    });

  } catch (error) {
    console.error('[Change Password Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to change password. Please try again.'
    });
  }
};
