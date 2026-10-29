const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  toggleBanUser,
  getSystemStats,
  getAuditLogs,
  broadcastAnnouncement,
} = require('../controllers/adminController');
const { masterAdminProtect } = require('../middleware/masterAdminProtect');

// All routes require Master Admin Passphrase & 2FA Token via middleware
router.use(masterAdminProtect);

router.get('/users', getAllUsers);
router.put('/users/:id/ban', toggleBanUser);
router.get('/stats', getSystemStats);
router.get('/audit-logs', getAuditLogs);
router.post('/broadcast', broadcastAnnouncement);

module.exports = router;
