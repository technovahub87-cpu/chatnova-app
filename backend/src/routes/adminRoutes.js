
const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const {
  getAllUsers,
  toggleBanUser,
  getSystemStats,
  getAuditLogs,
  broadcastAnnouncement
} = require('../controllers/adminController');

const {
  masterAdminProtect
} = require('../middleware/masterAdminProtect');

// Strict rate limit for Master Admin endpoints.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many Master Admin requests. Please wait 15 minutes.'
  }
});

// Every Admin API request must pass both security checks.
router.use(adminLimiter);
router.use(masterAdminProtect);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/ban', toggleBanUser);

// System monitoring
router.get('/stats', getSystemStats);
router.get('/audit-logs', getAuditLogs);

// Global announcement
router.post('/broadcast', broadcastAnnouncement);

module.exports = router;
