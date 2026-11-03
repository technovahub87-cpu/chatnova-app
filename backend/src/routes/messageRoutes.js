
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

const {
  uploadVideoMessage,
  streamMediaFile
} = require('../controllers/mediaController');

const {
  uploadAttachment,
  streamAttachment
} = require('../controllers/attachmentController');

router.use(protect);

// Voice messages
router.get('/voice/:fileId', streamVoiceMessage);

router.post(
  '/:conversationId/voice',
  express.raw({
    type: 'audio/*',
    limit: '10mb'
  }),
  uploadVoiceMessage
);

// Video messages
router.get('/media/:fileId', streamMediaFile);

router.post(
  '/:conversationId/video',
  express.raw({
    type: 'video/*',
    limit: '50mb'
  }),
  uploadVideoMessage
);

// Image and document attachments
router.get('/attachment/:fileId', streamAttachment);

router.post(
  '/:conversationId/attachment',
  express.raw({
    type: () => true,
    limit: '25mb'
  }),
  uploadAttachment
);

// Normal chat messages
router.get('/:conversationId', getMessages);
router.post('/:conversationId', sendMessage);

module.exports = router;
