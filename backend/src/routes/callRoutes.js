
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/protect');
const { getCallHistory } = require('../controllers/callController');

// All call history routes require authentication
router.use(protect);

// GET /api/calls?type=all
// GET /api/calls?type=voice
// GET /api/calls?type=video
router.get('/', getCallHistory);

module.exports = router;
