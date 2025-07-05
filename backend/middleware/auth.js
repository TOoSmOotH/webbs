const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Verify JWT token
const verifyJWT = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// General authentication middleware that supports both session tokens and JWT
const authenticate = async (req, res, next) => {
  try {
    let user = null;
    
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyJWT(token);
      
      if (decoded) {
        // Verify user still exists and is active
        const result = await db.query(
          'SELECT id, username, email, display_name, is_admin, role, user_level FROM users WHERE id = $1 AND is_active = true',
          [decoded.id]
        );
        
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
    }
    
    // If no JWT or invalid JWT, check for session token
    if (!user) {
      const sessionToken = req.headers['x-session-token'] || req.body.sessionToken || req.query.sessionToken;
      
      if (sessionToken) {
        const result = await db.query(`
          SELECT u.id, u.username, u.email, u.display_name, u.is_admin, u.role, u.user_level
          FROM users u
          JOIN sessions s ON u.id = s.user_id
          WHERE s.session_token = $1 AND s.is_active = true AND s.expires_at > CURRENT_TIMESTAMP
        `, [sessionToken]);
        
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Attach user to request
    req.user = user;
    req.isAdmin = user.is_admin;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional authentication - doesn't fail if no auth provided
const optionalAuth = async (req, res, next) => {
  try {
    let user = null;
    
    // Check for JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyJWT(token);
      
      if (decoded) {
        const result = await db.query(
          'SELECT id, username, email, display_name, is_admin, role, user_level FROM users WHERE id = $1 AND is_active = true',
          [decoded.id]
        );
        
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
    }
    
    // If no JWT, check for session token
    if (!user) {
      const sessionToken = req.headers['x-session-token'] || req.body.sessionToken || req.query.sessionToken;
      
      if (sessionToken) {
        const result = await db.query(`
          SELECT u.id, u.username, u.email, u.display_name, u.is_admin, u.role, u.user_level
          FROM users u
          JOIN sessions s ON u.id = s.user_id
          WHERE s.session_token = $1 AND s.is_active = true AND s.expires_at > CURRENT_TIMESTAMP
        `, [sessionToken]);
        
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
    }
    
    // Attach user if found (but don't fail if not)
    if (user) {
      req.user = user;
      req.isAdmin = user.is_admin;
    }
    
    next();
  } catch (error) {
    // On error, just continue without auth
    next();
  }
};

// Require specific user level
const requireUserLevel = (minLevel) => {
  return async (req, res, next) => {
    await authenticate(req, res, () => {
      if (req.user.user_level < minLevel) {
        return res.status(403).json({ error: `User level ${minLevel} or higher required` });
      }
      next();
    });
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireUserLevel,
  verifyJWT
};