
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const PrivacySettings = require('../models/PrivacySettings');

const getConnectedPeers = async (userId) => {
  const conversations = await Conversation.find({
    participants: userId,
    isActive: true
  }).select('participants type').lean();

  const allPeers = new Set();
  const directPeers = new Set();

  for (const conversation of conversations) {
    for (const participantId of conversation.participants) {
      const peerId = String(participantId);

      if (peerId === String(userId)) continue;

      allPeers.add(peerId);

      if (conversation.type === 'direct') {
        directPeers.add(peerId);
      }
    }
  }

  return { allPeers, directPeers };
};

const canView = (visibility, isContact) => {
  if (visibility === 'nobody') return false;
  if (visibility === 'contacts') return isContact;
  return true;
};

const notifyPresence = async (io, userId, status, lastSeen) => {
  const settings = await PrivacySettings.findOne({
    user: userId
  }).lean();

  const { allPeers, directPeers } = await getConnectedPeers(userId);

  for (const peerId of allPeers) {
    const isContact = directPeers.has(peerId);
    const payload = { userId: String(userId) };

    const onlineVisibility =
      settings?.onlineStatusVisibility || 'everyone';

    const lastSeenVisibility =
      settings?.lastSeenVisibility || 'everyone';

    if (canView(onlineVisibility, isContact)) {
      payload.status = status;
    }

    if (
      status === 'offline' &&
      canView(lastSeenVisibility, isContact)
    ) {
      payload.lastSeen = lastSeen;
    }

    if (Object.keys(payload).length > 1) {
      io.to(`user:${peerId}`).emit('presence:update', payload);
    }
  }
};

const deliverPendingMessages = async (io, userId) => {
  const pendingMessages = await Message.find({
    recipient: userId,
    status: 'sent'
  }).select('_id chatId sender').lean();

  if (pendingMessages.length === 0) return;

  const messageIds = pendingMessages.map((message) => message._id);
  const deliveredAt = new Date();

  await Message.updateMany(
    {
      _id: { $in: messageIds },
      recipient: userId,
      status: 'sent'
    },
    {
      $set: {
        status: 'delivered',
        deliveredAt
      }
    }
  );

  const senderGroups = new Map();

  for (const message of pendingMessages) {
    const senderId = String(message.sender);
    const conversationId = String(message.chatId);

    if (!senderGroups.has(senderId)) {
      senderGroups.set(senderId, new Map());
    }

    const conversations = senderGroups.get(senderId);

    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, []);
    }

    conversations.get(conversationId).push(String(message._id));
  }

  for (const [senderId, conversations] of senderGroups) {
    for (const [conversationId, ids] of conversations) {
      io.to(`user:${senderId}`).emit('chat:message_status', {
        conversationId,
        messageIds: ids,
        status: 'delivered',
        deliveredAt
      });
    }
  }
};

const setUserOnline = async (io, userId) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $set: { status: 'online' }
    });

    await notifyPresence(io, userId, 'online', null);
    await deliverPendingMessages(io, userId);
  } catch (error) {
    console.error('[Presence Online Error]:', error.message);
  }
};

const setUserOffline = async (io, userId) => {
  try {
    const lastSeen = new Date();

    await User.findByIdAndUpdate(userId, {
      $set: {
        status: 'offline',
        lastSeen
      }
    });

    await notifyPresence(io, userId, 'offline', lastSeen);
  } catch (error) {
    console.error('[Presence Offline Error]:', error.message);
  }
};

module.exports = {
  setUserOnline,
  setUserOffline
};
