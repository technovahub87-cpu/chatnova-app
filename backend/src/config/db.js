
const mongoose = require('mongoose');

let retryTimer = null;
let isConnecting = false;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('[ChatNova DB] MONGO_URI is missing.');
    return false;
  }

  if (isConnecting) {
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  isConnecting = true;

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      autoIndex: process.env.NODE_ENV !== 'production'
    });

    console.log(
      `[ChatNova DB] Connected successfully: ${mongoose.connection.name}`
    );

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    return true;

  } catch (error) {
    console.error('[ChatNova DB] Connection failed:', error.message);

    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connectDB();
      }, 5000);

      retryTimer.unref();
    }

    return false;

  } finally {
    isConnecting = false;
  }
};

// Monitor database connection.
mongoose.connection.on('disconnected', () => {
  console.warn('[ChatNova DB] Database disconnected.');

  if (!retryTimer && process.env.MONGO_URI) {
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connectDB();
    }, 5000);

    retryTimer.unref();
  }
});

mongoose.connection.on('error', (error) => {
  console.error('[ChatNova DB] Runtime error:', error.message);
});

module.exports = connectDB;
