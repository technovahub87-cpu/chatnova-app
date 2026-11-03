
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

const onlineUsers = new Map();
const activeCalls = new Map();

const CALL_RING_TIMEOUT_MS = 45000;
const MAX_SDP_LENGTH = 100000;

const isValidCallId = (value) =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9_-]{8,80}$/.test(value);

const clearCall = (callId) => {
  const call = activeCalls.get(callId);
  if (call?.ringTimer) clearTimeout(call.ringTimer);
  activeCalls.delete(callId);
};

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

    // Secure conversation joining
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

    socket.on('chat:leave', (data = {}) => {
      const conversationId = data.conversationId;

      if (
        typeof conversationId !== 'string' ||
        !mongoose.Types.ObjectId.isValid(conversationId)
      ) {
        return;
      }

      socket.leave(`conversation:${conversationId}`);

      socket.emit('chat:left', { conversationId });
    });

    // Typing notifications
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

        if (!conversation) return;

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

    // Start a secure one-to-one voice call
    socket.on('call:invite', async (data = {}) => {
      try {
        const { conversationId, callId } = data;

        if (
          typeof conversationId !== 'string' ||
          !mongoose.Types.ObjectId.isValid(conversationId) ||
          !isValidCallId(callId)
        ) {
          return socket.emit('call:error', {
            callId,
            message: 'Invalid call request.'
          });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          type: 'direct',
          participants: user.id,
          isActive: true
        }).select('_id participants');

        if (!conversation || conversation.participants.length !== 2) {
          return socket.emit('call:error', {
            callId,
            message: 'Calls are available only in an active one-to-one chat.'
          });
        }

        const peerId = conversation.participants
          .map((id) => String(id))
          .find((id) => id !== user.id);

        if (!peerId) {
          return socket.emit('call:error', {
            callId,
            message: 'Call recipient could not be verified.'
          });
        }

        const peerSockets = await io.in(`user:${peerId}`).fetchSockets();

        if (peerSockets.length === 0) {
          return socket.emit('call:error', {
            callId,
            message: 'This contact is offline. Try again later.'
          });
        }

        const alreadyInCall = [...activeCalls.values()].some(
          (call) =>
            call.callerId === user.id ||
            call.calleeId === user.id ||
            call.callerId === peerId ||
            call.calleeId === peerId
        );

        if (alreadyInCall) {
          return socket.emit('call:error', {
            callId,
            message: 'One of the users is already in a call.'
          });
        }

        const call = {
          callId,
          conversationId,
          callerId: user.id,
          calleeId: peerId,
          type: 'voice',
          status: 'ringing',
          ringTimer: null
        };

        call.ringTimer = setTimeout(() => {
          const current = activeCalls.get(callId);

          if (!current || current.status !== 'ringing') return;

          io.to(`user:${current.callerId}`).emit('call:timeout', {
            callId,
            conversationId
          });

          io.to(`user:${current.calleeId}`).emit('call:missed', {
            callId,
            conversationId
          });

          clearCall(callId);
        }, CALL_RING_TIMEOUT_MS);

        activeCalls.set(callId, call);

        io.to(`user:${peerId}`).emit('call:incoming', {
          callId,
          conversationId,
          type: 'voice',
          caller: {
            id: user.id,
            customId: user.customId,
            displayName: user.displayName
          }
        });

        socket.emit('call:ringing', {
          callId,
          conversationId,
          recipientId: peerId
        });
      } catch (error) {
        console.error('[Call Invite Error]:', error.message);

        socket.emit('call:error', {
          callId: data.callId,
          message: 'Unable to start the voice call.'
        });
      }
    });

    // Accept incoming call
    socket.on('call:accept', (data = {}) => {
      const { callId } = data;
      const call = activeCalls.get(callId);

      if (
        !call ||
        call.calleeId !== user.id ||
        call.status !== 'ringing'
      ) {
        return socket.emit('call:error', {
          callId,
          message: 'This incoming call is no longer available.'
        });
      }

      if (call.ringTimer) clearTimeout(call.ringTimer);

      call.ringTimer = null;
      call.status = 'connected';

      io.to(`user:${call.callerId}`).emit('call:accepted', {
        callId,
        conversationId: call.conversationId
      });

      socket.emit('call:accepted', {
        callId,
        conversationId: call.conversationId
      });
    });

    // Reject incoming call
    socket.on('call:reject', (data = {}) => {
      const { callId } = data;
      const call = activeCalls.get(callId);

      if (
        !call ||
        call.calleeId !== user.id ||
        call.status !== 'ringing'
      ) {
        return;
      }

      io.to(`user:${call.callerId}`).emit('call:rejected', {
        callId,
        conversationId: call.conversationId
      });

      clearCall(callId);
    });

    // End active call
    socket.on('call:end', (data = {}) => {
      const { callId } = data;
      const call = activeCalls.get(callId);

      if (
        !call ||
        (call.callerId !== user.id && call.calleeId !== user.id)
      ) {
        return;
      }

      const otherUserId =
        call.callerId === user.id ? call.calleeId : call.callerId;

      io.to(`user:${otherUserId}`).emit('call:ended', {
        callId,
        conversationId: call.conversationId,
        endedBy: user.id
      });

      socket.emit('call:ended', {
        callId,
        conversationId: call.conversationId,
        endedBy: user.id
      });

      clearCall(callId);
    });

    // Relay WebRTC offer and answer only to verified call participants
    const relayCallSignal = (eventName, expectedSender, targetEvent) => {
      socket.on(eventName, (data = {}) => {
        const { callId, signal } = data;
        const call = activeCalls.get(callId);

        if (
          !call ||
          call.status !== 'connected' ||
          call[expectedSender] !== user.id ||
          !signal ||
          typeof signal !== 'object'
        ) {
          return socket.emit('call:error', {
            callId,
            message: 'Invalid or unauthorized call signal.'
          });
        }

        if (
          (eventName === 'call:offer' ||
            eventName === 'call:answer') &&
          (
            typeof signal.sdp !== 'string' ||
            signal.sdp.length === 0 ||
            signal.sdp.length > MAX_SDP_LENGTH
          )
        ) {
          return socket.emit('call:error', {
            callId,
            message: 'Invalid call session description.'
          });
        }

        const targetId =
          expectedSender === 'callerId'
            ? call.calleeId
            : call.callerId;

        io.to(`user:${targetId}`).emit(targetEvent, {
          callId,
          conversationId: call.conversationId,
          signal,
          fromUserId: user.id
        });
      });
    };

    relayCallSignal('call:offer', 'callerId', 'call:offer');
    relayCallSignal('call:answer', 'calleeId', 'call:answer');

    // Relay ICE network candidates
    socket.on('call:ice-candidate', (data = {}) => {
      const { callId, signal } = data;
      const call = activeCalls.get(callId);

      if (
        !call ||
        call.status !== 'connected' ||
        (call.callerId !== user.id && call.calleeId !== user.id) ||
        !signal ||
        typeof signal !== 'object' ||
        typeof signal.candidate !== 'string' ||
        signal.candidate.length === 0 ||
        signal.candidate.length > 5000
      ) {
        return;
      }

      const targetId =
        call.callerId === user.id
          ? call.calleeId
          : call.callerId;

      io.to(`user:${targetId}`).emit('call:ice-candidate', {
        callId,
        conversationId: call.conversationId,
        signal,
        fromUserId: user.id
      });
    });

    // Message sending remains protected by the REST API
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

      // Keep a call alive if the same user has another connected device.
      (async () => {
        const remainingSockets =
          await io.in(`user:${user.id}`).fetchSockets();

        if (remainingSockets.length > 0) return;

        for (const [callId, call] of activeCalls.entries()) {
          if (
            call.callerId !== user.id &&
            call.calleeId !== user.id
          ) {
            continue;
          }

          const otherUserId =
            call.callerId === user.id
              ? call.calleeId
              : call.callerId;

          io.to(`user:${otherUserId}`).emit('call:ended', {
            callId,
            conversationId: call.conversationId,
            endedBy: user.id,
            reason: 'disconnected'
          });

          clearCall(callId);
        }
      })().catch((error) => {
        console.error('[Call Disconnect Error]:', error.message);
      });

      console.log('[Socket Disconnected]:', user.customId);
    });
  });
};
