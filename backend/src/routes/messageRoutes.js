
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/protect');

const {
  getMessages,
  sendMessage
} = require('../controllers/messageController');

// Every message request requires a valid login.
router.use(protect);

// Read messages from a conversation.
router.get('/:conversationId', getMessages);

// Send a text message to a conversation.
router.post('/:conversationId', sendMessage);

module.exports = router;
