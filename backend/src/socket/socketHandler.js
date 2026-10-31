module.exports = (io) => {
  io.on('connection', (socket) => {
    socket.on('chat:join', (chatId) => {
      socket.join(chatId);
    });

    socket.on('chat:send_message', (data) => {
      const payload = {
        ...data,
        id: data.tempId || 'msg_' + Date.now(),
        status: 'delivered',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Sirf us specific chat room ke doosre user ko bhejo, sender ko nahi
      socket.to(data.chatId).emit('chat:new_message', payload);
    });

    socket.on('chat:typing', (data) => {
      socket.to(data.chatId).emit('chat:typing', data);
    });
  });
};
