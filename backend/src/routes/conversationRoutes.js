
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/protect');

const {
  createDirectConversation,
  createGroupConversation,
  getMyConversations,
  getConversationById,
  leaveGroupConversation
} = require('../controllers/conversationController');

// All conversation routes require an authenticated account.
router.use(protect);

// Get the logged-in user's conversations.
router.get('/', getMyConversations);

// Start or retrieve a private one-to-one conversation.
router.post('/direct', createDirectConversation);

// Create a group conversation.
router.post('/group', createGroupConversation);

// Open a conversation only if the logged-in user is a member.
router.post('/:conversationId/leave', leaveGroupConversation);
router.get('/:conversationId', getConversationById);

module.exports = router;
