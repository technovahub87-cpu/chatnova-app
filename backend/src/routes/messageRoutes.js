
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/protect');

const {
  getMessages,
  sendMessage,
  markMessagesRead
} = require('../controllers/messageController');

const {
  messageAction
} = require('../controllers/messageActionController');

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
  express.raw({ type: 'audio/*', limit: '10mb' }),
  uploadVoiceMessage
);

// Video messages
router.get('/media/:fileId', streamMediaFile);

router.post(
  '/:conversationId/video',
  express.raw({ type: 'video/*', limit: '50mb' }),
  uploadVideoMessage
);

// File and image attachments
router.get('/attachment/:fileId', streamAttachment);

router.post(
  '/:conversationId/attachment',
  express.raw({ type: () => true, limit: '25mb' }),
  uploadAttachment
);

// Mark incoming messages as read
router.post('/:conversationId/read', markMessagesRead);

// Reply, Forward and Delete actions
router.post(
  '/:conversationId/:messageId/action',
  messageAction
);

// Fetch and send messages
router.get('/:conversationId', getMessages);

router.post('/:conversationId', sendMessage);

module.exports = router;
