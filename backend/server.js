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

// Routes
app.use('/api/terminal', terminalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/files', fileRoutes);

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
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});