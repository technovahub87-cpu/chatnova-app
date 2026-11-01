const Message = require('../models/Message');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected with socket ID:', socket.id);

    // User authentication and mapping
    socket.on('auth:init', (data) => {
      if (data) {
        const uId = data.userId || data.customId;
        if (uId) {
          onlineUsers.set(String(uId), socket.id);
          onlineUsers.set(String(uId).toLowerCase(), socket.id);
          socket.join(String(uId));
          console.log(`Authenticated user mapped: ${uId} -> ${socket.id}`);
        }
      }
    });

    // Join specific chat room
    socket.on('chat:join', (chatId) => {
      if (chatId) {
        socket.join(chatId);
      }
    });

    // Handle sending messages with MongoDB persistence
    socket.on('chat:send_message', async (data) => {
      try {
        const chatId = data.chatId;
        const senderId = data.senderId;
        const recipientId = data.recipientId;

        // 1. Save message to MongoDB permanently
        const newMessage = new Message({
          chatId: chatId,
          senderId: senderId,
          senderName: data.senderName || 'User',
          recipientId: recipientId,
          content: data.content,
          type: data.type || 'text',
          media: data.media || null,
          voice: data.voice || null,
          status: 'delivered',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        await newMessage.save();

        const payload = {
          id: newMessage._id || data.tempId,
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

        // 2. Deliver to recipient socket if online
        if (recipientId) {
          const recipientSocketId = onlineUsers.get(String(recipientId)) || onlineUsers.get(String(recipientId).toLowerCase());
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('chat:new_message', payload);
          }
          // Also emit to recipient's personal room
          io.to(String(recipientId)).emit('chat:new_message', payload);
        }

        // 3. Emit to chat room
        if (chatId) {
          socket.to(chatId).emit('chat:new_message', payload);
        }

        // 4. Global broadcast fallback for instant sync across browsers
        socket.broadcast.emit('chat:new_message', payload);

      } catch (err) {
        console.error('Error saving or sending message:', err);
      }
    });

    // Typing status handler
    socket.on('chat:typing', (data) => {
      if (data && data.chatId) {
        socket.to(data.chatId).emit('chat:typing', data);
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      for (let [key, val] of onlineUsers.entries()) {
        if (val === socket.id) {
          onlineUsers.delete(key);
          break;
        }
      }
      console.log('User disconnected socket ID:', socket.id);
    });
  });
};
