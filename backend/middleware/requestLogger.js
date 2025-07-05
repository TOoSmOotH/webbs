const logger = require('../utils/logger');

// Middleware to log API requests
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Capture original end function
  const originalEnd = res.end;
  
  // Override end function to log after response
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    const userId = req.user?.id || req.admin?.id || null;
    
    // Log the request
    logger.logApiRequest(
      req.method,
      req.originalUrl || req.url,
      res.statusCode,
      responseTime,
      userId,
      req
    ).catch(err => console.error('Request logging error:', err));
    
    // Call original end function
    originalEnd.apply(res, args);
  };
  
  next();
};

// Middleware for admin action logging
const adminActionLogger = (actionType) => {
  return async (req, res, next) => {
    // Store original json function
    const originalJson = res.json;
    
    // Override json function to log successful actions
    res.json = function(data) {
      if (res.statusCode < 400 && req.admin) {
        logger.logAdminAction(actionType, {
          ...req.body,
          ...req.params,
          ...req.query,
          targetId: req.params.id,
          adminId: req.admin.id,
          adminUsername: req.admin.username
        }, req.admin.id, req).catch(err => console.error('Admin action logging error:', err));
      }
      
      // Call original json function
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const userId = req.user?.id || req.admin?.id || null;
  
  logger.error(err.message, {
    stack: err.stack,
    url: req.originalUrl || req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    headers: req.headers
  }, userId, req).catch(logErr => console.error('Error logging failed:', logErr));
  
  next(err);
};

// Security event logging
const securityLogger = (eventType) => {
  return async (req, res, next) => {
    const userId = req.user?.id || req.admin?.id || null;
    
    await logger.logSecurityEvent(eventType, 'warn', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      url: req.originalUrl || req.url,
      method: req.method
    }, userId, req);
    
    next();
  };
};

// Rate limit logging
const rateLimitLogger = (req, res) => {
  const userId = req.user?.id || req.admin?.id || null;
  
  logger.logSecurityEvent('rate_limit_exceeded', 'warn', {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    url: req.originalUrl || req.url,
    method: req.method
  }, userId, req).catch(err => console.error('Rate limit logging error:', err));
};

module.exports = {
  requestLogger,
  adminActionLogger,
  errorLogger,
  securityLogger,
  rateLimitLogger
};