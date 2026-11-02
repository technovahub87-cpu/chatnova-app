
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

// Generate Authenticator App QR code.
router.post('/authenticator/setup', protect, setupAuthenticator);

// Verify Authenticator App and activate 2FA.
router.post('/authenticator/verify-setup', protect, verifyAuthenticatorSetup);

// --------------------------------------------------
// PROTECTED USER PROFILE ROUTE
// --------------------------------------------------

router.get('/me', protect, getMe);

module.exports = router;
