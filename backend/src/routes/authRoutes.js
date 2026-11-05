
const express = require('express');
const router = express.Router();

const {
  register,
  verifyRegistrationOtp,
  login,
  forgotPassword,
  setupAuthenticator,
  verifyAuthenticatorSetup,
  getMe
} = require('../controllers/authController');

const {
  changePassword
} = require('../controllers/passwordController');

const {
  updateProfile
} = require('../controllers/profileController');

const {
  uploadProfileImage,
  getProfileImage,
  deleteProfileImage
} = require('../controllers/profileImageController');

const {
  getPrivacySettings,
  updatePrivacySettings
} = require('../controllers/privacyController');

const {
  getMySessions,
  revokeSession
} = require('../controllers/sessionController');

const {
  createDevicePairing,
  claimDevicePairing,
  getDevicePairingStatus,
  approveDevicePairing,
  rejectDevicePairing,
  completeDevicePairing
} = require('../controllers/devicePairingController');

const {
  getNotificationSettings,
  updateNotificationSettings
} = require('../controllers/notificationController');

const {
  registerPushToken,
  removePushToken
} = require('../controllers/pushTokenController');

const {
  getStatuses,
  createStatus,
  markStatusViewed,
  deleteStatus,
  getStatusViewers
} = require('../controllers/statusController');

const {
  createMediaStatus,
  getStatusMedia
} = require('../controllers/statusMediaController');

const { protect } = require('../middleware/protect');

// Registration and login
router.post('/register', register);
router.post('/verify-registration-otp', verifyRegistrationOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Authenticator
router.post('/authenticator/setup', protect, setupAuthenticator);
router.post('/authenticator/verify-setup', protect, verifyAuthenticatorSetup);

// Change password
router.put('/change-password', protect, changePassword);

// User profile
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// Privacy settings
router.get('/privacy', protect, getPrivacySettings);
router.put('/privacy', protect, updatePrivacySettings);

// Notification settings
router.get('/notifications', protect, getNotificationSettings);
router.put('/notifications', protect, updateNotificationSettings);

// Push notification device tokens
router.post('/push-token', protect, registerPushToken);
router.delete('/push-token', protect, removePushToken);

// Linked devices and sessions
router.get('/sessions', protect, getMySessions);
router.delete('/sessions/:sessionId', protect, revokeSession);

// QR device pairing
router.post('/device-pairing/create', protect, createDevicePairing);
router.post('/device-pairing/claim', claimDevicePairing);
router.get('/device-pairing/:pairingId/status', protect, getDevicePairingStatus);
router.post('/device-pairing/:pairingId/approve', protect, approveDevicePairing);
router.post('/device-pairing/:pairingId/reject', protect, rejectDevicePairing);
router.post('/device-pairing/complete', completeDevicePairing);

// Status
router.get('/statuses', protect, getStatuses);
router.post('/statuses', protect, createStatus);
router.post('/statuses/media', protect, createMediaStatus);
router.get('/statuses/:statusId/media', protect, getStatusMedia);
router.post('/statuses/:statusId/view', protect, markStatusViewed);
router.get('/statuses/:statusId/viewers', protect, getStatusViewers);
router.delete('/statuses/:statusId', protect, deleteStatus);

// Profile photo
router.get('/profile-image/:userId', getProfileImage);
router.post('/profile-image', protect, uploadProfileImage);
router.delete('/profile-image', protect, deleteProfileImage);

module.exports = router;
