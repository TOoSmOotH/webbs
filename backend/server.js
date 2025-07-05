const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const db = require('./config/database');
const terminalRoutes = require('./routes/terminal');
const userRoutes = require('./routes/users');
const boardRoutes = require('./routes/boards');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');
const ansiArtRoutes = require('./routes/ansiArt');
const menuRoutes = require('./routes/menus');
const menuDisplayRoutes = require('./routes/menuDisplay');
const { requestLogger, errorLogger } = require('./middleware/requestLogger');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// Routes
app.use('/api/terminal', terminalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ansi-art', ansiArtRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/menu-display', menuDisplayRoutes);

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
const activeSessions = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Store socket with session info
  socket.on('join-session', (sessionId) => {
    activeSessions.set(sessionId, socket.id);
    socket.sessionId = sessionId;
  });

  // Handle terminal input (legacy support)
  socket.on('terminal-input', (data) => {
    console.log('Terminal input:', data);
    
    // Echo back for now (basic implementation)
    socket.emit('terminal-output', {
      text: `Echo: ${data.text}`,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.sessionId) {
      activeSessions.delete(socket.sessionId);
    }
  });
});

// Make io and activeSessions available to routes
app.set('io', io);
app.set('activeSessions', activeSessions);

// Error handling middleware
app.use(errorLogger);
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log server startup
  await logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
  
  // Schedule log rotation if in production
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      logger.rotateLogs(30).catch(err => console.error('Log rotation error:', err));
    }, 24 * 60 * 60 * 1000); // Daily
  }
});