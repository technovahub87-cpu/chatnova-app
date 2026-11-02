
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const onlineUsers = new Map();

module.exports = (io) => {
  // Every socket connection must have a valid ChatNova JWT.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication token required.'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('Authentication service unavailable.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded || !decoded.id) {
        return next(new Error('Invalid authentication token.'));
      }

      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('ChatNova account not found.'));
      }

      if (
        decoded.tokenVersion !== undefined &&
        decoded.tokenVersion !== (user.tokenVersion || 0)
      ) {
        return next(new Error('Session expired. Please log in again.'));
      }

      if (user.isBanned) {
        return next(new Error('This ChatNova account is suspended.'));
      }

      if (!user.mobileVerified || !user.authenticatorEnabled) {
        return next(new Error('Account security setup is incomplete.'));
      }

      socket.user = {
        id: String(user._id),
        customId: user.customId,
        displayName: user.displayName,
        role: user.role
      };

      return next();
    } catch (error) {
      console.error('[Socket Authentication Error]:', error.message);
      return next(new Error('Socket authentication failed.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;

    if (!user) {
      socket.disconnect(true);
      return;
    }

    console.log('[Socket Connected]:', user.customId);

    // Only the authenticated user's private room is joined.
    const privateRoom = `user:${user.id}`;

    socket.join(privateRoom);
    onlineUsers.set(user.id, socket.id);

    socket.emit('socket:authenticated', {
      success: true,
      userId: user.id,
      customId: user.customId
    });

    // Never accept identity information from the client.
    socket.on('auth:init', () => {
      socket.emit('socket:error', {
        message: 'Identity is verified automatically during connection.'
      });
    });

    // Chat membership verification is not implemented yet.
    // Reject arbitrary room access until a secure Conversation model exists.
    socket.on('chat:join', () => {
      socket.emit('socket:error', {
        message: 'Chat access is temporarily unavailable while security is being configured.'
      });
    });

    // Prevent unauthorised message injection.
    socket.on('chat:send_message', () => {
      socket.emit('socket:error', {
        message: 'Messaging is temporarily disabled until secure chat membership is ready.'
      });
    });

    socket.on('chat:typing', () => {
      socket.emit('socket:error', {
        message: 'Typing events are temporarily unavailable.'
      });
    });

    socket.on('disconnect', () => {
      if (onlineUsers.get(user.id) === socket.id) {
        onlineUsers.delete(user.id);
      }

      console.log('[Socket Disconnected]:', user.customId);
    });
  });
};
