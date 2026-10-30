module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join target chat room
    socket.on('chat:join', (chatId) => {
      socket.join(chatId);
      console.log(`Socket ${socket.id} joined room ${chatId}`);
    });

    // Handle send message & broadcast to everyone in that chat room
    socket.on('chat:send_message', (data) => {
      console.log('Message received on server:', data);
      
      // Ensure status is delivered/sent
      const payload = {
        ...data,
        id: data.tempId || 'msg_' + Date.now(),
        status: 'sent',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Broadcast to room (including sender & receiver)
      io.to(data.chatId).emit('chat:new_message', payload);
      // Also broadcast globally as fallback
      socket.broadcast.emit('chat:new_message', payload);
    });

    // Typing status relay
    socket.on('chat:typing', (data) => {
      socket.to(data.chatId).emit('chat:typing', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
