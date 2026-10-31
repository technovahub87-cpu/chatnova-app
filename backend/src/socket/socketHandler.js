const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Register user socket mapping for direct delivery
    socket.on('auth:init', (data) => {
      if (data && (data.userId || data.customId)) {
        onlineUsers.set(data.userId, socket.id);
        if (data.customId) {
          onlineUsers.set(data.customId.toLowerCase(), socket.id);
        }
        console.log(`User authenticated on socket: ${socket.id} -> ${data.customId || data.userId}`);
      }
    });

    socket.on('chat:join', (chatId) => {
      socket.join(chatId);
      console.log(`Socket ${socket.id} joined room: ${chatId}`);
    });

    socket.on('chat:send_message', (data) => {
      console.log('Message relayed on server:', data);
      
      const payload = {
        ...data,
        id: data.tempId || 'msg_' + Date.now(),
        status: 'delivered',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // 1. Broadcast to specific chat room
      if (data.chatId) {
        socket.to(data.chatId).emit('chat:new_message', payload);
      }

      // 2. Direct recipient fallback delivery if online
      if (data.recipientId) {
        const recipientSocketId = onlineUsers.get(data.recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('chat:new_message', payload);
        }
      }

      // 3. Global fallback to ensure cross-browser delivery during testing
      socket.broadcast.emit('chat:new_message', payload);
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
