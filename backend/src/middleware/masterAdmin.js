const masterAdminProtect = (req, res, next) => {
  const adminSecret = req.headers['x-master-admin-secret'] || req.body.adminSecret;
  const twoFactorToken = req.headers['x-master-2fa-token'] || req.body.twoFactorToken;

  const validSecret = process.env.MASTER_ADMIN_SECRET || 'NovaMaster@2026';
  const valid2FA = process.env.MASTER_ADMIN_2FA_TOKEN || '774921';

  if (!adminSecret || !twoFactorToken) {
    return res.status(401).json({
      success: false,
      message: 'Missing Master Admin Passphrase or 2FA Token credentials.',
    });
  }

  if (adminSecret !== validSecret || twoFactorToken !== valid2FA) {
    return res.status(403).json({
      success: false,
      message: 'Invalid Master Admin credentials. Security event logged.',
    });
  }

  next();
};

module.exports = { masterAdminProtect };
