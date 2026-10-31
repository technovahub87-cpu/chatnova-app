const Message = require('../models/Message');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('auth:init', (data) => {
      if (data && (data.userId || data.customId)) {
        onlineUsers.set(data.userId, socket.id);
        if (data.customId) {
          onlineUsers.set(data.customId.toLowerCase(), socket.id);
        }
      }
    });

    socket.on('chat:join', (chatId) => {
      socket.join(chatId);
    });

    socket.on('chat:send_message', async (data) => {
      try {
        // 1. Save message to MongoDB database for permanent persistence
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

        // 2. Broadcast to chat room
        if (data.chatId) {
          socket.to(data.chatId).emit('chat:new_message', payload);
        }

        // 3. Direct recipient fallback delivery
        if (data.recipientId) {
          const recipientSocketId = onlineUsers.get(data.recipientId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('chat:new_message', payload);
          }
        }
      } catch (err) {
        console.error('Error saving message to MongoDB:', err);
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
    });
  });
};
