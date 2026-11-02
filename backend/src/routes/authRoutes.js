
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

const { updateProfile } = require('../controllers/profileController');
const { protect } = require('../middleware/protect');

// --------------------------------------------------
// PUBLIC AUTHENTICATION ROUTES
// --------------------------------------------------

// Create a new account and send registration SMS OTP.
router.post('/register', register);

// Verify the one-time SMS OTP during registration.
router.post('/verify-registration-otp', verifyRegistrationOtp);

// Login using Custom ID, password and Authenticator code.
router.post('/login', login);

// Reset password using Authenticator or recovery code.
router.post('/forgot-password', forgotPassword);

// --------------------------------------------------
// PROTECTED AUTHENTICATOR ROUTES
// --------------------------------------------------

router.post('/authenticator/setup', protect, setupAuthenticator);

router.post('/authenticator/verify-setup', protect, verifyAuthenticatorSetup);

// --------------------------------------------------
// PROTECTED USER PROFILE ROUTES
// --------------------------------------------------

router.get('/me', protect, getMe);

router.put('/profile', protect, updateProfile);

module.exports = router;
