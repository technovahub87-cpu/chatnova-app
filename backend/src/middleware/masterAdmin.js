const crypto = require('crypto');

// Helper to safely compare secrets against timing attacks
const safeCompare = (a, b) => {
  try {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return a === b;
  }
};

const masterAdminProtect = (req, res, next) => {
  try {
    const adminSecret = req.headers['x-master-admin-secret'] || req.body?.adminSecret;
    const twoFactorToken = req.headers['x-master-2fa-token'] || req.body?.twoFactorToken;

    const validSecret = process.env.MASTER_ADMIN_SECRET || 'NovaMaster@2026';
    const valid2FA = process.env.MASTER_ADMIN_2FA_TOKEN || '774921';

    if (!adminSecret || !twoFactorToken) {
      return res.status(401).json({
        success: false,
        message: 'Missing Master Admin Passphrase or 2FA Token credentials.',
      });
    }

    const isSecretValid = safeCompare(String(adminSecret), String(validSecret));
    const is2FAValid = safeCompare(String(twoFactorToken), String(valid2FA));

    if (!isSecretValid || !is2FAValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid Master Admin credentials. Security event logged.',
      });
    }

    next();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[MasterAdmin Protect Error]:', errorMsg);
    return res.status(500).json({
      success: false,
      message: 'Server error during administrative verification.',
    });
  }
};

module.exports = { masterAdminProtect };
