const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');

// Get user info
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT id, username, display_name, created_at, last_login FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    
    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, created_at',
      [username, email, passwordHash, displayName || username]
    );
    
    const newUser = result.rows[0];
    
    // Log activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [newUser.id, 'user_registered', { username, email }]
    );
    
    res.json({
      success: true,
      message: 'User registration successful',
      user: {
        id: newUser.id,
        username: newUser.username,
        display_name: newUser.display_name,
        created_at: newUser.created_at
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const result = await db.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Create session
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await db.query(
      'INSERT INTO sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
      [user.id, sessionToken, expiresAt]
    );
    
    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    // Log activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [user.id, 'user_login', { username }]
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        user_level: user.user_level
      },
      session: {
        token: sessionToken,
        expires_at: expiresAt
      }
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User logout
router.post('/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }
    
    // Deactivate session
    await db.query('UPDATE sessions SET is_active = false WHERE session_token = $1', [sessionToken]);
    
    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate session
router.post('/validate-session', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }
    
    const result = await db.query(`
      SELECT u.id, u.username, u.display_name, u.user_level, s.expires_at
      FROM users u
      JOIN sessions s ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.is_active = true AND s.expires_at > CURRENT_TIMESTAMP
    `, [sessionToken]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        user_level: user.user_level
      }
    });
  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;