
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const callRoutes = require('./routes/callRoutes');
const blockedUserRoutes = require('./routes/blockedUserRoutes');

const initSocket = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let masterBootstrapRunning = false;

const bootstrapMasterAdmin = async () => {
  if (masterBootstrapRunning || mongoose.connection.readyState !== 1) {
    return;
  }

  const configuredId = String(
    process.env.MASTER_ADMIN_CUSTOM_ID || ''
  ).trim().toLowerCase();

  if (!configuredId) {
    console.warn('[ChatNova] MASTER_ADMIN_CUSTOM_ID is not configured.');
    return;
  }

  const customId = configuredId.startsWith('@')
    ? configuredId
    : `@${configuredId}`;

  if (!/^@[a-z0-9_]{3,24}$/.test(customId)) {
    console.error('[ChatNova] Invalid MASTER_ADMIN_CUSTOM_ID format.');
    return;
  }

  masterBootstrapRunning = true;

  try {
    const targetUser = await User.findOne({
      customId,
      mobileVerified: true,
      authenticatorEnabled: true,
      isBanned: false
    });

    if (!targetUser) {
      return;
    }

    if (targetUser.role === 'master_admin') {
      return;
    }

    const existingMaster = await User.findOne({
      role: 'master_admin'
    });

    if (existingMaster) {
      console.error(
        '[ChatNova] Another Master Admin already exists. Automatic promotion stopped.'
      );
      return;
    }

    targetUser.role = 'master_admin';
    await targetUser.save();

    console.log(
      `[ChatNova] Master Admin successfully configured for ${customId}.`
    );
  } catch (error) {
    console.error(
      '[ChatNova] Master Admin setup failed:',
      error.message
    );
  } finally {
    masterBootstrapRunning = false;
  }
};

mongoose.connection.on('connected', () => {
  bootstrapMasterAdmin();
});

const masterBootstrapInterval = setInterval(() => {
  bootstrapMasterAdmin();
}, 15000);

masterBootstrapInterval.unref();

connectDB();

app.disable('x-powered-by');
app.use(helmet());

app.use(
  morgan(NODE_ENV === 'production' ? 'combined' : 'dev')
);

const corsOrigin = process.env.CORS_ORIGIN || '*';

const allowedOrigins =
  corsOrigin === '*'
    ? true
    : corsOrigin.split(',').map((origin) => origin.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json({ limit: '25mb' }));

app.use(express.urlencoded({
  extended: true,
  limit: '25mb'
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many API requests. Please try again later.'
  }
});

app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes.'
  }
});

app.use('/api/auth', authLimiter);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

app.set('io', io);
initSocket(io);

app.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'ONLINE',
    app: 'ChatNova',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/blocked-users', blockedUserRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'API endpoint not found.'
  });
});

app.use((err, req, res, next) => {
  const errorMsg =
    err instanceof Error ? err.message : String(err);

  console.error('[Server Error]:', errorMsg);

  const statusCode = err.status || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : errorMsg
  });
});

server.listen(PORT, () => {
  console.log('==========================================');
  console.log('       ChatNova Backend Started');
  console.log('==========================================');
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log('REST API: Active');
  console.log('Conversation API: Active');
  console.log('Message API: Active');
  console.log('Call History API: Active');
  console.log('Socket.IO: Active');
  console.log('==========================================');
});

const gracefulShutdown = () => {
  console.log('[ChatNova] Shutting down gracefully...');

  clearInterval(masterBootstrapInterval);

  server.close(() => {
    console.log('[ChatNova] Server connections closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[ChatNova] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
