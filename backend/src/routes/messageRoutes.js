
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/protect');

const {
  getMessages,
  sendMessage
} = require('../controllers/messageController');

const {
  uploadVoiceMessage,
  streamVoiceMessage
} = require('../controllers/voiceController');

router.use(protect);

// Voice message playback
router.get('/voice/:fileId', streamVoiceMessage);

// Voice message upload
router.post(
  '/:conversationId/voice',
  express.raw({
    type: 'audio/*',
    limit: '10mb'
  }),
  uploadVoiceMessage
);

// Normal chat messages
router.get('/:conversationId', getMessages);
router.post('/:conversationId', sendMessage);

module.exports = router;
