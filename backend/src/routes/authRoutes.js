
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

// Profile photo
router.get('/profile-image/:userId', getProfileImage);
router.post('/profile-image', protect, uploadProfileImage);
router.delete('/profile-image', protect, deleteProfileImage);

module.exports = router;
