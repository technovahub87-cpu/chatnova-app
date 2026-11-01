const Message = require('../models/Message');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New user connected socket ID:', socket.id);

    socket.on('auth:init', (data) => {
      if (data) {
        const uId = data.userId || data.customId;
        if (uId) {
          onlineUsers.set(String(uId), socket.id);
          onlineUsers.set(String(uId).toLowerCase(), socket.id);
          socket.join(String(uId));
          console.log(`User authenticated and mapped: ${uId} -> ${socket.id}`);
        }
      }
    });

    socket.on('chat:join', (chatId) => {
      if (chatId) socket.join(chatId);
    });

    socket.on('chat:send_message', async (data) => {
      try {
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

        // Send directly to recipient if online
        if (data.recipientId) {
          const recipientSocket = onlineUsers.get(String(data.recipientId)) || onlineUsers.get(String(data.recipientId).toLowerCase());
          if (recipientSocket) {
            io.to(recipientSocket).emit('chat:new_message', payload);
          }
          io.to(String(data.recipientId)).emit('chat:new_message', payload);
        }

        if (data.chatId) {
          socket.to(data.chatId).emit('chat:new_message', payload);
        }

        // Global broadcast fallback so recipient gets it instantly
        socket.broadcast.emit('chat:new_message', payload);

      } catch (err) {
        console.error('Socket message error:', err);
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
