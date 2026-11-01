const Message = require('../models/Message');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected with socket ID:', socket.id);

    // Extract auth data from handshake auth or query if available
    const initialAuth = socket.handshake.auth || socket.handshake.query;
    if (initialAuth && (initialAuth.userId || initialAuth.customId)) {
      const uId = initialAuth.userId || initialAuth.customId;
      onlineUsers.set(String(uId), socket.id);
      onlineUsers.set(String(uId).toLowerCase(), socket.id);
      socket.join(String(uId));
      console.log(`Auto-Authenticated via handshake: ${uId} -> ${socket.id}`);
    }

    // User authentication and mapping event
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
        console.log(`Socket ${socket.id} joined chat room: ${chatId}`);
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
            console.log(`Delivered to recipient socket: ${recipientSocketId}`);
          }
          // Also emit to recipient's personal room (guaranteed delivery if joined)
          io.to(String(recipientId)).emit('chat:new_message', payload);
        }

        // 3. Emit to chat room (so both participants in room get it)
        if (chatId) {
          socket.to(chatId).emit('chat:new_message', payload);
        }

        // 4. Send back confirmation/echo to sender as well if needed, or broadcast fallback
        socket.emit('chat:message_sent', payload);
        socket.broadcast.emit('chat:new_message', payload);

        console.log(`[Message Sent] From ${senderId} to ${recipientId || chatId}`);

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
