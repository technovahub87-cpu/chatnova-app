const User = require('../models/User');
const Message = require('../models/Message');

// In-memory mapping of active users
const onlineUsers = new Map(); // userId -> { socketId, customId }
const socketToUser = new Map(); // socketId -> userId

const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket.io] New client connected: ${socket.id}`);

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

        onlineUsers.set(userId, { socketId: socket.id, customId });
        socketToUser.set(socket.id, userId);

        user.status = 'online';
        user.currentSocketId = socket.id;
        user.lastSeen = new Date();
        await user.save();

        socket.join(`user:${userId}`);

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

        if (undeliveredMessages.length > 0) {
          for (const msg of undeliveredMessages) {
            msg.status = 'delivered';
            msg.deliveredAt = new Date();
            await msg.save();

            socket.emit('chat:new_message', msg);

            const senderPresence = onlineUsers.get(msg.sender.toString());
            if (senderPresence) {
              io.to(senderPresence.socketId).emit('chat:message_status', {
                messageId: msg._id,
                chatId: msg.chatId,
                status: 'delivered',
              });
            }
          }
        }
      } catch (err) {
        console.error('[Socket auth:init error]:', err);
      }
    });

    /**
     * 2. REAL-TIME MESSAGE TRANSMISSION (Fixed payload extraction)
     */
    socket.on('chat:send_message', async (data) => {
      try {
        // Handle both nested message object and flat properties seamlessly
        const chatId = data?.chatId || data?.message?.chatId;
        const recipientId = data?.recipientId || data?.message?.recipientId;
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

        let recipient = null;
        if (recipientId) {
          recipient = await User.findById(recipientId);
        }

        // Persist message in MongoDB
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

        // Acknowledge sender
        socket.emit('chat:message_acknowledged', {
          tempId: tempId,
          message: newMessage,
          status: 'sent',
        });

        // Deliver to recipient if online
        if (recipient) {
          const recipientPresence = onlineUsers.get(recipient._id.toString());

          if (recipientPresence) {
            io.to(recipientPresence.socketId).emit('chat:new_message', newMessage);

            newMessage.status = 'delivered';
            newMessage.deliveredAt = new Date();
            await newMessage.save();

            socket.emit('chat:message_status', {
              messageId: newMessage._id,
              chatId,
              status: 'delivered',
            });
          }
        } else {
          socket.to(`chat:${chatId}`).emit('chat:new_message', newMessage);
        }
      } catch (err) {
        console.error('[Socket chat:send_message error]:', err);
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
        if (messageIds && messageIds.length > 0) {
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
        console.error('[Socket chat:mark_read error]:', err);
      }
    });

    /**
     * 4. TYPING INDICATORS
     */
    socket.on('chat:typing', (data) => {
      const { chatId, recipientId, isTyping, senderCustomId } = data || {};
      if (recipientId) {
        const recipientPresence = onlineUsers.get(recipientId);
        if (recipientPresence) {
          io.to(recipientPresence.socketId).emit('chat:typing', {
            chatId,
            isTyping,
            senderCustomId,
          });
        }
      } else if (chatId) {
        socket.to(`chat:${chatId}`).emit('chat:typing', {
          chatId,
          isTyping,
          senderCustomId,
        });
      }
    });

    /**
     * 5. JOIN / LEAVE ROOMS
     */
    socket.on('chat:join', (chatId) => {
      if (chatId) socket.join(`chat:${chatId}`);
    });

    socket.on('chat:leave', (chatId) => {
      if (chatId) socket.leave(`chat:${chatId}`);
    });

    /**
     * 6. DISCONNECTION & CLEANUP
     */
    socket.on('disconnect', async () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);

        try {
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
        } catch (e) {
          console.error('[Socket disconnect update error]:', e);
        }
      }
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
