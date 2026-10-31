const Message = require('../models/Message');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Register user socket mapping
    socket.on('auth:init', (data) => {
      if (data && (data.userId || data.customId)) {
        onlineUsers.set(data.userId, socket.id);
        onlineUsers.set(String(data.userId), socket.id);
        if (data.customId) {
          onlineUsers.set(data.customId.toLowerCase(), socket.id);
          onlineUsers.set(data.customId, socket.id);
        }
        socket.join(data.userId);
        if (data.customId) socket.join(data.customId);
        console.log(`User authenticated & joined rooms: ${data.customId || data.userId}`);
      }
    });

    socket.on('chat:join', (chatId) => {
      if (chatId) socket.join(chatId);
    });

    socket.on('chat:send_message', async (data) => {
      try {
        // Save message to MongoDB database
        const newMessage = new Message({
          chatId: data.chatId,
          senderId: data.senderId,
          senderName: data.senderName,
          recipientId: data.recipientId,
          content: data.content,
          type: data.type || 'text',
          media: data.media || null,
          voice: data.voice || null,
          status: 'delivered',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        await newMessage.save();

        const payload = {
          id: newMessage._id,
          chatId: newMessage.chatId,
          senderId: newMessage.senderId,
          senderName: newMessage.senderName,
          recipientId: newMessage.recipientId,
          content: newMessage.content,
          type: newMessage.type,
          media: newMessage.media,
          voice: newMessage.voice,
          status: newMessage.status,
          timestamp: newMessage.timestamp,
        };

        // 1. Send to recipient socket directly if mapped
        if (data.recipientId) {
          const recipientSocketId = onlineUsers.get(data.recipientId) || onlineUsers.get(String(data.recipientId).toLowerCase());
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('chat:new_message', payload);
          }
          // Also emit to recipient's room
          io.to(data.recipientId).emit('chat:new_message', payload);
        }

        // 2. Broadcast to chat room
        if (data.chatId) {
          socket.to(data.chatId).emit('chat:new_message', payload);
        }

        // 3. Global safety broadcast so both users see it instantly
        socket.broadcast.emit('chat:new_message', payload);

      } catch (err) {
        console.error('Error in chat:send_message:', err);
      }
    });

    socket.on('chat:typing', (data) => {
      if (data && data.chatId) {
        socket.to(data.chatId).emit('chat:typing', data);
      }
    });

    socket.on('disconnect', () => {
      for (let [key, val] of onlineUsers.entries()) {
        if (val === socket.id) {
          onlineUsers.delete(key);
          break;
        }
      }
      console.log('User disconnected:', socket.id);
    });
  });
};
