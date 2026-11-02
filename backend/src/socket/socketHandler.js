
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

const onlineUsers = new Map();

module.exports = (io) => {
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

    socket.join(`user:${user.id}`);
    onlineUsers.set(user.id, socket.id);

    socket.emit('socket:authenticated', {
      success: true,
      userId: user.id,
      customId: user.customId
    });

    // Join only conversations where this user is a participant.
    socket.on('chat:join', async (data = {}) => {
      try {
        const conversationId = data.conversationId;

        if (
          typeof conversationId !== 'string' ||
          !mongoose.Types.ObjectId.isValid(conversationId)
        ) {
          return socket.emit('socket:error', {
            message: 'Invalid conversation ID.'
          });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: user.id,
          isActive: true
        }).select('_id');

        if (!conversation) {
          return socket.emit('socket:error', {
            message: 'You are not a member of this conversation.'
          });
        }

        socket.join(`conversation:${conversationId}`);

        socket.emit('chat:joined', {
          success: true,
          conversationId
        });
      } catch (error) {
        console.error('[Chat Join Error]:', error.message);

        socket.emit('socket:error', {
          message: 'Unable to join this conversation.'
        });
      }
    });

    // Leave a conversation room.
    socket.on('chat:leave', (data = {}) => {
      const conversationId = data.conversationId;

      if (
        typeof conversationId !== 'string' ||
        !mongoose.Types.ObjectId.isValid(conversationId)
      ) {
        return;
      }

      socket.leave(`conversation:${conversationId}`);

      socket.emit('chat:left', {
        conversationId
      });
    });

    // Typing notifications are allowed only for conversation members.
    socket.on('chat:typing', async (data = {}) => {
      try {
        const conversationId = data.conversationId;

        if (
          typeof conversationId !== 'string' ||
          !mongoose.Types.ObjectId.isValid(conversationId)
        ) {
          return;
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: user.id,
          isActive: true
        }).select('_id');

        if (!conversation) {
          return;
        }

        io.to(`conversation:${conversationId}`)
          .except(socket.id)
          .emit('chat:user_typing', {
            conversationId,
            userId: user.id,
            customId: user.customId,
            displayName: user.displayName,
            isTyping: data.isTyping === true
          });
      } catch (error) {
        console.error('[Typing Event Error]:', error.message);
      }
    });

    // Message sending is handled through the protected REST API.
    // This prevents clients from injecting unverified sender identities.
    socket.on('chat:send_message', () => {
      socket.emit('socket:error', {
        message: 'Please send messages through the secure ChatNova message API.'
      });
    });

    socket.on('auth:init', () => {
      socket.emit('socket:error', {
        message: 'Identity is verified automatically during connection.'
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
