const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/protect');

const {
  listBlockedUsers,
  blockUser,
  unblockUser
} = require('../controllers/blockedUserController');

router.use(protect);

router.get('/', listBlockedUsers);
router.post('/', blockUser);
router.delete('/:blockedUserId', unblockUser);

module.exports = router;
