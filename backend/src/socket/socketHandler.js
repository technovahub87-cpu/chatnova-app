const User = require('../models/User');
const Message = require('../models/Message');

// In-memory mapping of active users
const onlineUsers = new Map(); // userId -> { socketId, customId }
const socketToUser = new Map(); // socketId -> userId

const initSocket = (io) => {
  if (!io) return;

  io.on('connection', async (socket) => {
    console.log(`[Socket.io] New client connected: ${socket.id}`);

    // Automatically extract userId and customId from handshake auth if provided
    try {
      const handshakeAuth = socket.handshake?.auth || {};
      let initialUserId = handshakeAuth.userId;
      const initialCustomId = handshakeAuth.customId;

      if (initialUserId) {
        const user = await User.findById(initialUserId);
        if (user && !user.isBanned) {
          onlineUsers.set(initialUserId.toString(), { socketId: socket.id, customId: initialCustomId || user.customId });
          socketToUser.set(socket.id, initialUserId.toString());

          user.status = 'online';
          user.currentSocketId = socket.id;
          user.lastSeen = new Date();
          await user.save();

          socket.join(`user:${initialUserId.toString()}`);
          console.log(`[Socket.io] Auto-authenticated user via handshake: ${user.customId} (${socket.id})`);
        }
      }
    } catch (e) {
      console.error('[Socket Handshake Auth Error]:', e);
    }

    /**
     * 1. IDENTITY REGISTRATION / ONLINE PRESENCE
     */
    socket.on('auth:init', async (data) => {
      try {
        const { userId, customId } = data || {};
        if (!userId) return;

        const user = await User.findById(userId);
        if (!user || user.isBanned) {
          socket.emit('auth:error', { message: 'Identity banned or invalid.' });
          socket.disconnect();
          return;
        }

        onlineUsers.set(userId.toString(), { socketId: socket.id, customId });
        socketToUser.set(socket.id, userId.toString());

        user.status = 'online';
        user.currentSocketId = socket.id;
        user.lastSeen = new Date();
        await user.save();

        // Join personal user room for direct targeted delivery
        socket.join(`user:${userId.toString()}`);

        io.emit('user:presence_update', {
          userId,
          customId: user.customId,
          status: 'online',
          lastSeen: 'Online',
        });

        console.log(`[Socket.io] Identity online: ${user.customId} (${socket.id})`);

        // Deliver undelivered messages
        const undeliveredMessages = await Message.find({
          recipient: userId,
          status: 'sent',
        });

        if (Array.isArray(undeliveredMessages) && undeliveredMessages.length > 0) {
          for (const msg of undeliveredMessages) {
            msg.status = 'delivered';
            msg.deliveredAt = new Date();
            await msg.save();

            socket.emit('chat:new_message', msg);

            const senderIdStr = msg.sender ? msg.sender.toString() : '';
            if (senderIdStr) {
              io.to(`user:${senderIdStr}`).emit('chat:message_status', {
                messageId: msg._id,
                chatId: msg.chatId,
                status: 'delivered',
              });
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[Socket auth:init error]:', errorMsg);
      }
    });

    /**
     * 2. REAL-TIME MESSAGE TRANSMISSION
     */
    socket.on('chat:send_message', async (data) => {
      try {
        const chatId = data?.chatId || data?.message?.chatId;
        let recipientId = data?.recipientId || data?.message?.recipientId;
        const senderId = data?.senderId || data?.message?.senderId;
        const content = data?.content || data?.message?.content;
        const type = data?.type || data?.message?.type || 'text';
        const voice = data?.voice || data?.message?.voice;
        const media = data?.media || data?.message?.media;
        const tempId = data?.tempId || data?.message?.tempId;

        if (!chatId || !content || !senderId) {
          console.warn('[Socket] Missing required fields in chat:send_message:', data);
          return;
        }

        const sender = await User.findById(senderId);
        if (!sender || sender.isBanned) {
          socket.emit('error', { message: 'Cannot send message. Account suspended.' });
          return;
        }

        // Automatic recipient extraction from chatId if recipientId is missing
        let recipient = null;
        if (recipientId) {
          recipient = await User.findById(recipientId);
        } else if (chatId && chatId.includes('_')) {
          const parts = chatId.split('_');
          const otherUserId = parts.find(id => id !== senderId.toString());
          if (otherUserId) {
            recipient = await User.findById(otherUserId);
            recipientId = otherUserId;
          }
        }

        // Persist message in MongoDB with correct recipient ID
        const newMessage = await Message.create({
          chatId,
          sender: sender._id,
          senderCustomId: sender.customId,
          senderName: sender.displayName,
          recipient: recipient ? recipient._id : null,
          recipientCustomId: recipient ? recipient.customId : null,
          type,
          content,
          status: 'sent',
          voice: voice || null,
          media: media || null,
        });

        // Acknowledge sender immediately
        socket.emit('chat:message_acknowledged', {
          tempId: tempId,
          message: newMessage,
          status: 'sent',
        });

        // Deliver to recipient via personal user room (`user:${recipientId}`)
        if (recipient) {
          const recipientIdStr = recipient._id.toString();
          io.to(`user:${recipientIdStr}`).emit('chat:new_message', newMessage);

          newMessage.status = 'delivered';
          newMessage.deliveredAt = new Date();
          await newMessage.save();

          socket.emit('chat:message_status', {
            messageId: newMessage._id,
            chatId,
            status: 'delivered',
          });
        }

        // Broadcast to chat room listeners as well
        socket.to(`chat:${chatId}`).emit('chat:new_message', newMessage);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[Socket chat:send_message error]:', errorMsg);
      }
    });

    /**
     * 3. READ RECEIPT HANDLER
     */
    socket.on('chat:mark_read', async (data) => {
      try {
        const { chatId, messageIds, readerId } = data || {};
        if (!chatId || !readerId) return;

        const filter = { chatId, status: { $ne: 'read' } };
        if (Array.isArray(messageIds) && messageIds.length > 0) {
          filter._id = { $in: messageIds };
        }

        await Message.updateMany(filter, {
          status: 'read',
          readAt: new Date(),
        });

        io.emit('chat:read_receipt', {
          chatId,
          readerId,
          status: 'read',
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[Socket chat:mark_read error]:', errorMsg);
      }
    });

    /**
     * 4. TYPING INDICATORS
     */
    socket.on('chat:typing', (data) => {
      try {
        const { chatId, recipientId, isTyping, senderCustomId, senderName } = data || {};
        if (recipientId) {
          io.to(`user:${recipientId.toString()}`).emit('chat:typing', {
            chatId,
            isTyping,
            senderCustomId,
            senderName,
          });
        } else if (chatId) {
          socket.to(`chat:${chatId}`).emit('chat:typing', {
            chatId,
            isTyping,
            senderCustomId,
            senderName,
          });
        }
      } catch (e) {}
    });

    /**
     * 5. JOIN / LEAVE ROOMS
     */
    socket.on('chat:join', (chatId) => {
      if (chatId && typeof chatId === 'string') socket.join(`chat:${chatId}`);
    });

    socket.on('chat:leave', (chatId) => {
      if (chatId && typeof chatId === 'string') socket.leave(`chat:${chatId}`);
    });

    /**
     * 6. DISCONNECTION & CLEANUP
     */
    socket.on('disconnect', async () => {
      try {
        const userId = socketToUser.get(socket.id);
        if (userId) {
          onlineUsers.delete(userId);
          socketToUser.delete(socket.id);

          const user = await User.findById(userId);
          if (user) {
            user.status = 'offline';
            user.lastSeen = new Date();
            user.currentSocketId = null;
            await user.save();

            io.emit('user:presence_update', {
              userId,
              customId: user.customId,
              status: 'offline',
              lastSeen: user.lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          }
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('[Socket disconnect update error]:', errorMsg);
      }
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};

model.exports = initSocket;
