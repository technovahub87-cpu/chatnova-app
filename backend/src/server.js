require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const initSocket = require('./socket/socketHandler');

// 1. Initialize Express Application
const app = express();
const server = http.createServer(app);

// 2. Connect Database
connectDB();

// 3. Security & Logging Middlewares
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS configuration for REST APIs
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Global Rate Limiting to prevent automated abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP enclave. Please wait 15 minutes.',
  },
});
app.use('/api/', apiLimiter);

// 4. Initialize Socket.io Server with CORS
const io = new Server(server, {
  cors: {
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8, // 100 MB buffer for encrypted voice/media
});

// Attach socket.io instance to Express app so controllers can emit broadcasts
app.set('io', io);

// Initialize Socket.io real-time events engine
initSocket(io);

// 5. REST API Routes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    app: 'ChatNova Offshore Relay Engine',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 6. 404 & Global Error Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Cryptographic API endpoint not found.' });
});

app.use((err, req, res, next) => {
  console.error('[Unhandled Global Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal cryptographic server error.',
  });
});

// 7. Start Server Listener
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🔒 ChatNova Offshore Engine Initialized`);
  console.log(`  • REST API: http://localhost:${PORT}`);
  console.log(`  • WebSocket Gateway: ws://localhost:${PORT}`);
  console.log(`  • Master Admin Pass: ${process.env.MASTER_ADMIN_SECRET || 'NovaMaster@2026'}`);
  console.log(`  • Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`=======================================================`);
});

// Graceful Shutdown
const gracefulShutdown = () => {
  console.log('\n[ChatNova] Shutting down server gracefully...');
  server.close(() => {
    console.log('[ChatNova] HTTP & WebSocket servers closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
