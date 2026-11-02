
const crypto = require('crypto');
const speakeasy = require('speakeasy');

const safeCompare = (first, second) => {
  if (typeof first !== 'string' || typeof second !== 'string') {
    return false;
  }

  const a = Buffer.from(first);
  const b = Buffer.from(second);

  if (a.length !== b.length || a.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
};

const masterAdminProtect = (req, res, next) => {
  try {
    const adminSecret = process.env.MASTER_ADMIN_SECRET;
    const totpSecret = process.env.MASTER_ADMIN_TOTP_SECRET;

    // Never use hardcoded fallback credentials.
    if (!adminSecret || !totpSecret) {
      console.error('[Master Admin] Required environment secrets are missing.');

      return res.status(503).json({
        success: false,
        message: 'Master Admin security is not configured.'
      });
    }

    // Credentials must be sent through request headers.
    const suppliedSecret = req.headers['x-master-admin-secret'];
    const suppliedToken = req.headers['x-master-2fa-token'];

    if (
      typeof suppliedSecret !== 'string' ||
      typeof suppliedToken !== 'string'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Master Admin credentials are required.'
      });
    }

    const secretValid = safeCompare(
      suppliedSecret,
      adminSecret
    );

    const tokenValid =
      /^\d{6}$/.test(suppliedToken) &&
      speakeasy.totp.verify({
        secret: totpSecret,
        encoding: 'base32',
        token: suppliedToken,
        window: 1
      });

    if (!secretValid || !tokenValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid Master Admin credentials.'
      });
    }

    return next();

  } catch (error) {
    console.error(
      '[Master Admin Security Error]:',
      error instanceof Error ? error.message : String(error)
    );

    return res.status(500).json({
      success: false,
      message: 'Administrative verification failed.'
    });
  }
};

module.exports = { masterAdminProtect };
