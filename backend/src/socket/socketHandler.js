const Message = require('../models/Message');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected with socket ID:', socket.id);

    // Helper to map both userId, customId, and socket.id
    const registerUserMapping = (authData) => {
      if (!authData) return;
      const { userId, customId } = authData;
      if (userId) {
        onlineUsers.set(String(userId), socket.id);
        onlineUsers.set(String(userId).toLowerCase(), socket.id);
        socket.join(String(userId));
      }
      if (customId) {
        const formattedCustom = customId.startsWith('@') ? customId : `@${customId}`;
        onlineUsers.set(String(formattedCustom), socket.id);
        onlineUsers.set(String(formattedCustom).toLowerCase(), socket.id);
        socket.join(String(formattedCustom));
      }
    };

    // Extract auth data from handshake auth or query if available
    registerUserMapping(socket.handshake.auth || socket.handshake.query);

    // User authentication and mapping event
    socket.on('auth:init', (data) => {
      registerUserMapping(data);
      console.log(`Authenticated user socket mapped for ID: ${socket.id}`);
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
        const senderCustomId = data.senderCustomId;
        const recipientCustomId = data.recipientCustomId;

        // 1. Save message to MongoDB permanently
        const newMessage = new Message({
          chatId: chatId,
          senderId: senderId,
          senderName: data.senderName || 'User',
          recipientId: recipientId || recipientCustomId,
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
          senderCustomId: senderCustomId,
          senderName: newMessage.senderName,
          recipientId: newMessage.recipientId,
          content: newMessage.content,
          type: newMessage.type,
          media: newMessage.media,
          voice: newMessage.voice,
          status: newMessage.status,
          timestamp: newMessage.timestamp,
        };

        // 2. Deliver to chat room participants (Ensures both sender and receiver get it instantly)
        if (chatId) {
          io.to(chatId).emit('chat:new_message', payload);
          console.log(`[Socket Broadcast] Emitted to chat room: ${chatId}`);
        }

        // 3. Fallback direct delivery to recipient via ID, Custom ID or socket rooms
        const targets = [recipientId, recipientCustomId].filter(Boolean);
        targets.forEach((target) => {
          const cleanTarget = String(target).trim();
          const variants = [
            cleanTarget,
            cleanTarget.toLowerCase(),
            cleanTarget.startsWith('@') ? cleanTarget : `@${cleanTarget}`,
            cleanTarget.startsWith('@') ? cleanTarget.toLowerCase() : `@${cleanTarget.toLowerCase()}`
          ];

          let targetSocketId = null;
          for (const v of variants) {
            if (onlineUsers.has(v)) {
              targetSocketId = onlineUsers.get(v);
              break;
            }
          }

          if (targetSocketId) {
            io.to(targetSocketId).emit('chat:new_message', payload);
            console.log(`Delivered directly to recipient socket: ${targetSocketId}`);
          }
          // Also broadcast to room matching recipient ID/Custom ID
          variants.forEach((v) => {
            io.to(v).emit('chat:new_message', payload);
          });
        });

        // Send confirmation back to sender socket
        socket.emit('chat:message_sent', payload);
        console.log(`[Message Successfully Processed] From ${senderId} to ${recipientId || chatId}`);

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
        }
      }
      console.log('User disconnected socket ID:', socket.id);
    });
  });
};
