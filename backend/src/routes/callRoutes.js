
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/protect');

const {
  getCallHistory,
  getTurnIceServers
} = require('../controllers/callController');

// All call routes require authentication.
router.use(protect);

// GET /api/calls/turn-ice-servers
router.get('/turn-ice-servers', getTurnIceServers);

// GET /api/calls?type=all
// GET /api/calls?type=voice
// GET /api/calls?type=video
router.get('/', getCallHistory);

module.exports = router;
