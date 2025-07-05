const jwt = require('jsonwebtoken');
const db = require('../config/database');

// JWT secret - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Generate JWT token for admin
const generateAdminToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      is_admin: user.is_admin,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Middleware to authenticate admin requests
const adminAuth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Verify user still exists and is active admin
    const result = await db.query(
      'SELECT id, username, email, display_name, is_admin, role FROM users WHERE id = $1 AND is_active = true AND is_admin = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Admin access required' });
    }

    // Attach user info to request
    req.admin = result.rows[0];
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware for role-based access control
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      // First run admin auth
      await adminAuth(req, res, () => {
        // Check if user has required role
        if (!roles.includes(req.admin.role)) {
          return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
        }
        next();
      });
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};

// Optional: Middleware that allows both regular users and admins
const optionalAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without admin privileges
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded) {
      // Verify user exists
      const result = await db.query(
        'SELECT id, username, email, display_name, is_admin, role FROM users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );

      if (result.rows.length > 0) {
        req.user = result.rows[0];
        req.isAdmin = result.rows[0].is_admin;
      }
    }
    next();
  } catch (error) {
    // If there's an error, continue without auth
    next();
  }
};

module.exports = {
  adminAuth,
  requireRole,
  optionalAdminAuth,
  generateAdminToken,
  verifyToken
};