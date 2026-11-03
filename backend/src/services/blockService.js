const BlockedUser = require('../models/BlockedUser');

const isBlockedBetween = async (userA, userB) => {
  if (!userA || !userB) {
    return false;
  }

  const blockRecord = await BlockedUser.exists({
    $or: [
      {
        blocker: userA,
        blocked: userB
      },
      {
        blocker: userB,
        blocked: userA
      }
    ]
  });

  return Boolean(blockRecord);
};

module.exports = {
  isBlockedBetween
};
