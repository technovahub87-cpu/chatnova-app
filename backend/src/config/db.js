const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chatnova';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    console.log(`[ChatNova DB] MongoDB Connected: ${conn.connection.host} (${conn.connection.name})`);
  } catch (error) {
    console.error(`[ChatNova DB] Connection Error: ${error.message}`);
    // In production, do not crash outright on transient outages; retry
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
