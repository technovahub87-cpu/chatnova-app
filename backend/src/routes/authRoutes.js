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
  updateProfile
} = require('../controllers/profileController');

const {
  uploadProfileImage,
  getProfileImage,
  deleteProfileImage
} = require('../controllers/profileImageController');

const { protect } = require('../middleware/protect');

router.post('/register', register);
router.post('/verify-registration-otp', verifyRegistrationOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

router.post('/authenticator/setup', protect, setupAuthenticator);
router.post('/authenticator/verify-setup', protect, verifyAuthenticatorSetup);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

router.get('/profile-image/:userId', getProfileImage);
router.post('/profile-image', protect, uploadProfileImage);
router.delete('/profile-image', protect, deleteProfileImage);

module.exports = router;
