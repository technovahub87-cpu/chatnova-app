
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');

// --------------------------------------------------
// BASIC HELPERS
// --------------------------------------------------

const generateToken = (id, tokenVersion = 0) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    { id, tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const normalizeCustomId = (value) => {
  let customId = String(value || '').trim().toLowerCase();

  if (!customId.startsWith('@')) {
    customId = `@${customId}`;
  }

  if (!/^@[a-z0-9_]{3,24}$/.test(customId)) {
    throw new Error('ChatNova ID must start with @ and contain 3-24 valid characters.');
  }

  return customId;
};

const generateFingerprint = () => {
  const parts = [];

  for (let i = 0; i < 6; i++) {
    parts.push(crypto.randomInt(1000, 10000).toString());
  }

  return parts.join(' ');
};

const safeUser = (user) => ({
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
});

const normalizeMobileNumber = (value) => {
  let mobile = String(value || '').replace(/\D/g, '');

  if (mobile.length === 10) {
    mobile = `91${mobile}`;
  }

  if (mobile.length < 10 || mobile.length > 15) {
    throw new Error('Please provide a valid mobile number with country code.');
  }

  return mobile;
};

// --------------------------------------------------
// AUTHENTICATOR SECRET ENCRYPTION
// --------------------------------------------------

const getEncryptionKey = () => {
  const key = process.env.AUTH_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      'AUTH_ENCRYPTION_KEY must be a 64-character hexadecimal key.'
    );
  }

  return Buffer.from(key, 'hex');
};

const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex')
  ].join(':');
};

const decryptSecret = (encryptedValue) => {
  const parts = String(encryptedValue || '').split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted authenticator secret.');
  }

  const [ivHex, tagHex, encryptedHex] = parts;

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8');
};

// --------------------------------------------------
// OTP AND RECOVERY CODE HELPERS
// --------------------------------------------------

const hashValue = (value) => {
  return crypto
    .createHash('sha256')
    .update(String(value))
    .digest('hex');
};

const safeCompare = (first, second) => {
  const a = Buffer.from(String(first || ''), 'hex');
  const b = Buffer.from(String(second || ''), 'hex');

  return a.length === b.length &&
    a.length > 0 &&
    crypto.timingSafeEqual(a, b);
};

const generateRecoveryCodes = () => {
  return Array.from({ length: 10 }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase()
  );
};

const verifyAuthenticatorCode = (user, code) => {
  if (!user.authenticatorSecretEncrypted) {
    return false;
  }

  const secret = decryptSecret(user.authenticatorSecretEncrypted);

  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(code || '').replace(/\s/g, ''),
    window: 1
  });
};

const consumeRecoveryCode = (user, code) => {
  const enteredHash = hashValue(
    String(code || '').trim().toUpperCase()
  );

  const codes = user.recoveryCodesHash || [];

  const index = codes.findIndex((savedHash) =>
    safeCompare(savedHash, enteredHash)
  );

  if (index === -1) {
    return false;
  }

  codes.splice(index, 1);
  user.recoveryCodesHash = codes;

  return true;
};

// --------------------------------------------------
// 2FACTOR SMS SERVICE
// --------------------------------------------------

const sendRegistrationOtp = async (mobileNumber) => {
  const apiKey = process.env.TWOFACTOR_API_KEY;

  if (!apiKey) {
    throw new Error('2Factor SMS API key is not configured.');
  }

  const url =
    `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}` +
    `/SMS/${encodeURIComponent(mobileNumber)}/AUTOGEN`;

  const response = await fetch(url);
  const result = await response.json();

  if (
    !response.ok ||
    result.Status !== 'Success' ||
    !result.Details
  ) {
    throw new Error('Unable to send registration OTP. Please try again.');
  }

  return result.Details;
};

const verifyRegistrationOtp = async (sessionId, otp) => {
  const apiKey = process.env.TWOFACTOR_API_KEY;

  const url =
    `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}` +
    `/SMS/VERIFY/${encodeURIComponent(sessionId)}` +
    `/${encodeURIComponent(String(otp).trim())}`;

  const response = await fetch(url);
  const result = await response.json();

  return response.ok && result.Status === 'Success';
};

// --------------------------------------------------
// REGISTER NEW ACCOUNT
// --------------------------------------------------

exports.register = async (req, res) => {
  try {
    const { customId, displayName, password, mobileNumber } = req.body;

    if (!customId || !password || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Custom ID, password and mobile number are required.'
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 8 characters.'
      });
    }

    const normalizedId = normalizeCustomId(customId);
    const mobile = normalizeMobileNumber(mobileNumber);

    let user = await User.findOne({ customId: normalizedId })
      .select(
        '+password +registrationOtpHash ' +
        '+registrationOtpExpiresAt +registrationOtpAttempts ' +
        '+registrationOtpLastSentAt'
      );

    if (user && user.mobileVerified) {
      return res.status(409).json({
        success: false,
        message: 'This ChatNova ID is already registered.'
      });
    }

    if (
      user &&
      user.registrationOtpLastSentAt &&
      Date.now() - user.registrationOtpLastSentAt.getTime() < 60000
    ) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 60 seconds before requesting another OTP.'
      });
    }

    const existingMobile = await User.findOne({
      mobileNumber: mobile,
      mobileVerified: true,
      ...(user ? { _id: { $ne: user._id } } : {})
    });

    if (existingMobile) {
      return res.status(409).json({
        success: false,
        message: 'This mobile number is already verified on another account.'
      });
    }

    const sessionId = await sendRegistrationOtp(mobile);

    if (!user) {
      user = new User({
        customId: normalizedId,
        displayName: String(displayName || normalizedId.slice(1)).trim(),
        password,
        mobileNumber: mobile,
        publicKeyFingerprint: generateFingerprint(),
        role: 'user'
      });
    } else {
      user.displayName = String(
        displayName || normalizedId.slice(1)
      ).trim();
      user.password = password;
      user.mobileNumber = mobile;
    }

    user.registrationOtpHash = sessionId;
    user.registrationOtpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    user.registrationOtpAttempts = 0;
    user.registrationOtpLastSentAt = new Date();

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Registration OTP sent. Verify your mobile number to continue.',
      customId: user.customId,
      otpRequired: true
    });

  } catch (error) {
    console.error('[Register Error]:', error.message);

    return res.status(400).json({
      success: false,
      message: error.message || 'Registration failed.'
    });
  }
};

// --------------------------------------------------
// VERIFY REGISTRATION SMS OTP
// --------------------------------------------------

exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { customId, otp } = req.body;

    if (!customId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'ChatNova ID and OTP are required.'
      });
    }

    const normalizedId = normalizeCustomId(customId);

    const user = await User.findOne({ customId: normalizedId })
      .select(
        '+registrationOtpHash +registrationOtpExpiresAt ' +
        '+registrationOtpAttempts'
      );

    if (!user || !user.registrationOtpHash) {
      return res.status(400).json({
        success: false,
        message: 'No pending registration OTP found.'
      });
    }

    if (
      !user.registrationOtpExpiresAt ||
      user.registrationOtpExpiresAt < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please register again.'
      });
    }

    if (user.registrationOtpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP attempts. Please register again.'
      });
    }

    user.registrationOtpAttempts += 1;
    await user.save();

    const verified = await verifyRegistrationOtp(
      user.registrationOtpHash,
      otp
    );

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration OTP.'
      });
    }

    user.mobileVerified = true;
    user.registrationOtpHash = null;
    user.registrationOtpExpiresAt = null;
    user.registrationOtpAttempts = 0;

    await user.save();

    const token = generateToken(user._id, user.tokenVersion || 0);

    return res.status(200).json({
      success: true,
      message: 'Mobile verified. Now set up your Authenticator App.',
      token,
      user: safeUser(user)
    });

  } catch (error) {
    console.error('[Registration OTP Error]:', error.message);

    return res.status(400).json({
      success: false,
      message: error.message || 'OTP verification failed.'
    });
  }
};

// --------------------------------------------------
// SET UP AUTHENTICATOR APP
// --------------------------------------------------

exports.setupAuthenticator = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+pendingAuthenticatorSecretEncrypted');

    if (!user || !user.mobileVerified) {
      return res.status(403).json({
        success: false,
        message: 'Verify your mobile number before setting up authentication.'
      });
    }

    if (user.authenticatorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Authenticator App is already enabled.'
      });
    }

    const secret = speakeasy.generateSecret({
      name: `ChatNova (${user.customId})`,
      issuer: 'ChatNova',
      length: 20
    });

    user.pendingAuthenticatorSecretEncrypted = encryptSecret(secret.base32);
    await user.save();

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return res.status(200).json({
      success: true,
      message: 'Scan this QR code with Google Authenticator or another TOTP app.',
      qrCode,
      manualEntryKey: secret.base32
    });

  } catch (error) {
    console.error('[Authenticator Setup Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to set up Authenticator App.'
    });
  }
};

// --------------------------------------------------
// VERIFY AUTHENTICATOR SETUP
// --------------------------------------------------

exports.verifyAuthenticatorSetup = async (req, res) => {
  try {
    const { code } = req.body;

    const user = await User.findById(req.user._id)
      .select('+pendingAuthenticatorSecretEncrypted +recoveryCodesHash');

    if (!user || !user.pendingAuthenticatorSecretEncrypted) {
      return res.status(400).json({
        success: false,
        message: 'Please start Authenticator App setup first.'
      });
    }

    const secret = decryptSecret(user.pendingAuthenticatorSecretEncrypted);

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: String(code || '').replace(/\s/g, ''),
      window: 1
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Authenticator code.'
      });
    }

    const recoveryCodes = generateRecoveryCodes();

    user.authenticatorSecretEncrypted = user.pendingAuthenticatorSecretEncrypted;
    user.pendingAuthenticatorSecretEncrypted = null;
    user.authenticatorEnabled = true;
    user.twoFactorEnabled = true;
    user.recoveryCodesHash = recoveryCodes.map(hashValue);

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Authenticator App enabled successfully.',
      recoveryCodes,
      warning: 'Save these recovery codes safely. Each code can be used only once.'
    });

  } catch (error) {
    console.error('[Authenticator Verify Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to verify Authenticator setup.'
    });
  }
};

// --------------------------------------------------
// LOGIN WITH CUSTOM ID + PASSWORD + AUTHENTICATOR
// --------------------------------------------------

exports.login = async (req, res) => {
  try {
    const { customId, password, authenticatorCode, recoveryCode } = req.body;

    if (!customId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Custom ID and password are required.'
      });
    }

    const normalizedId = normalizeCustomId(customId);

    const user = await User.findOne({ customId: normalizedId })
      .select(
        '+password +authenticatorSecretEncrypted +recoveryCodesHash'
      );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid ChatNova ID or password.'
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended by Master Administration.',
        banReason: user.banReason || 'Administrative suspension'
      });
    }

    if (!user.mobileVerified) {
      return res.status(403).json({
        success: false,
        message: 'Mobile verification is incomplete.'
      });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid ChatNova ID or password.'
      });
    }

    if (!user.authenticatorEnabled || !user.authenticatorSecretEncrypted) {
      return res.status(403).json({
        success: false,
        message: 'Authenticator App setup is required before login.'
      });
    }

    let secondFactorVerified = false;

    if (authenticatorCode) {
      secondFactorVerified = verifyAuthenticatorCode(
        user,
        authenticatorCode
      );
    } else if (recoveryCode) {
      secondFactorVerified = consumeRecoveryCode(user, recoveryCode);

      if (secondFactorVerified) {
        await user.save();
      }
    }

    if (!secondFactorVerified) {
      return res.status(401).json({
        success: false,
        message: 'Valid Authenticator code or unused recovery code is required.'
      });
    }

    const token = generateToken(user._id, user.tokenVersion || 0);

    return res.status(200).json({
      success: true,
      message: 'ChatNova login successful.',
      token,
      user: safeUser(user)
    });

  } catch (error) {
    console.error('[Login Error]:', error.message);

    return res.status(400).json({
      success: false,
      message: error.message || 'Login failed.'
    });
  }
};

// --------------------------------------------------
// FORGOT PASSWORD USING AUTHENTICATOR OR RECOVERY CODE
// --------------------------------------------------

exports.forgotPassword = async (req, res) => {
  try {
    const {
      customId,
      authenticatorCode,
      recoveryCode,
      newPassword
    } = req.body;

    if (!customId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'ChatNova ID and new password are required.'
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must contain at least 8 characters.'
      });
    }

    const normalizedId = normalizeCustomId(customId);

    const user = await User.findOne({ customId: normalizedId })
      .select(
        '+password +authenticatorSecretEncrypted +recoveryCodesHash'
      );

    if (!user || !user.mobileVerified || !user.authenticatorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Account or Authenticator setup could not be verified.'
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
        message: 'Valid Authenticator code or unused recovery code is required.'
      });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.'
    });

  } catch (error) {
    console.error('[Forgot Password Error]:', error.message);

    return res.status(400).json({
      success: false,
      message: error.message || 'Password reset failed.'
    });
  }
};

// --------------------------------------------------
// GET CURRENT USER PROFILE
// --------------------------------------------------

exports.getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('[Get Me Error]:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Server error retrieving profile.'
    });
  }
};
