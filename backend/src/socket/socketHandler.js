const User = require('../models/User');
const Message = require('../models/Message');

// In-memory mapping of active users: userId -> socketId and socketId -> userId
const onlineUsers = new Map(); // userId -> { socketId, customId }
const socketToUser = new Map(); // socketId -> userId

const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket.io] New client connected: ${socket.id}`);

    /**
     * 1. IDENTITY REGISTRATION / ONLINE PRESENCE
     * Client emits 'auth:init' with customId and userId upon establishing socket
     */
    socket.on('auth:init', async (data) => {
      try {
        const { userId, customId } = data;
        if (!userId) return;

        // Check if user is banned
        const user = await User.findById(userId);
        if (!user || user.isBanned) {
          socket.emit('auth:error', { message: 'Identity banned or invalid.' });
          socket.disconnect();
          return;
        }

        // Store mapping
        onlineUsers.set(userId, { socketId: socket.id, customId });
        socketToUser.set(socket.id, userId);

        // Update database presence
        user.status = 'online';
        user.currentSocketId = socket.id;
        user.lastSeen = new Date();
        await user.save();

        // Join personal room for targeted alerts
        socket.join(`user:${userId}`);

        // Broadcast presence to all connected clients
        io.emit('user:presence_update', {
          userId,
          customId: user.customId,
          status: 'online',
          lastSeen: 'Online',
        });

        console.log(`[Socket.io] Identity online: ${user.customId} (${socket.id})`);

        // Check for any undelivered messages sent to this user while offline
        const undeliveredMessages = await Message.find({
          recipient: userId,
          status: 'sent',
        });

        if (undeliveredMessages.length > 0) {
          for (const msg of undeliveredMessages) {
            msg.status = 'delivered';
            msg.deliveredAt = new Date();
            await msg.save();

            // Emit to recipient
            socket.emit('chat:new_message', msg);

            // Notify original sender that message is now delivered (double grey tick!)
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
     * 2. REAL-TIME MESSAGE TRANSMISSION
     * Handles text, voice note waveforms, and encrypted media attachments
     */
    socket.on('chat:send_message', async (data) => {
      try {
        const { chatId, recipientId, senderId, content, type, voice, media } = data;

        if (!chatId || !content || !senderId) return;

        const sender = await User.findById(senderId);
        if (!sender || sender.isBanned) {
          socket.emit('error', { message: 'Cannot send message. Account suspended.' });
          return;
        }

        let recipient = null;
        if (recipientId) {
          recipient = await User.findById(recipientId);
        }

        // 1. Create and persist message in MongoDB
        const newMessage = await Message.create({
          chatId,
          sender: sender._id,
          senderCustomId: sender.customId,
          senderName: sender.displayName,
          recipient: recipient ? recipient._id : null,
          recipientCustomId: recipient ? recipient.customId : null,
          type: type || 'text',
          content,
          status: 'sent', // Initial single tick
          voice: voice || null,
          media: media || null,
        });

        // Acknowledge sender that message is stored on relay (Single tick confirmed)
        socket.emit('chat:message_acknowledged', {
          tempId: data.tempId,
          message: newMessage,
          status: 'sent',
        });

        // 2. Check if recipient is actively online
        if (recipient) {
          const recipientPresence = onlineUsers.get(recipient._id.toString());

          if (recipientPresence) {
            // Deliver immediately via WebSocket
            io.to(recipientPresence.socketId).emit('chat:new_message', newMessage);

            // Update database status to 'delivered'
            newMessage.status = 'delivered';
            newMessage.deliveredAt = new Date();
            await newMessage.save();

            // Notify sender immediately: First double tick!
            socket.emit('chat:message_status', {
              messageId: newMessage._id,
              chatId,
              status: 'delivered',
            });
          }
        } else {
          // Group or channel broadcast
          socket.to(`chat:${chatId}`).emit('chat:new_message', newMessage);
        }
      } catch (err) {
        console.error('[Socket chat:send_message error]:', err);
      }
    });

    /**
     * 3. DOUBLE-TICK READ RECEIPT HANDLER ('read' blue ticks)
     */
    socket.on('chat:mark_read', async (data) => {
      try {
        const { chatId, messageIds, readerId } = data;
        if (!chatId || !readerId) return;

        // Update database: mark messages as 'read'
        const filter = { chatId, status: { $ne: 'read' } };
        if (messageIds && messageIds.length > 0) {
          filter._id = { $in: messageIds };
        }

        await Message.updateMany(filter, {
          status: 'read',
          readAt: new Date(),
        });

        // Broadcast to chat room participants (or specific sender)
        io.emit('chat:read_receipt', {
          chatId,
          readerId,
          status: 'read', // Double blue tick!
        });
      } catch (err) {
        console.error('[Socket chat:mark_read error]:', err);
      }
    });

    /**
     * 4. REAL-TIME TYPING INDICATORS
     */
    socket.on('chat:typing', (data) => {
      const { chatId, recipientId, isTyping, senderCustomId } = data;
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
     * 5. JOIN / LEAVE CHAT ROOMS
     */
    socket.on('chat:join', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on('chat:leave', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    /**
     * 6. DISCONNECTION & PRESENCE CLEANUP
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

            // Broadcast offline status
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
