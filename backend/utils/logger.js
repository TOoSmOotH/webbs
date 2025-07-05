const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

class SystemLogger {
  constructor() {
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4
    };
    
    this.logTypes = {
      AUTH: 'authentication',
      ADMIN: 'admin_action',
      USER: 'user_action',
      SYSTEM: 'system',
      FILE: 'file_operation',
      BOARD: 'board_operation',
      ERROR: 'error',
      SECURITY: 'security',
      API: 'api_request'
    };
  }

  async log(type, severity, message, details = {}, userId = null, req = null) {
    try {
      // Log to database
      await this.logToDatabase(type, severity, message, details, userId, req);
      
      // Log to file if enabled
      if (process.env.LOG_FILE_PATH) {
        await this.logToFile(type, severity, message, details, userId, req);
      }
      
      // Console log for development
      if (process.env.NODE_ENV !== 'production') {
        this.logToConsole(type, severity, message, details);
      }
    } catch (error) {
      console.error('Logging error:', error);
    }
  }

  async logToDatabase(type, severity, message, details, userId, req) {
    try {
      // Ensure system_logs table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS system_logs (
          id SERIAL PRIMARY KEY,
          log_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          details JSONB,
          user_id INTEGER REFERENCES users(id),
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {}); // Ignore if table already exists

      await db.query(
        `INSERT INTO system_logs (log_type, severity, message, details, user_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          type,
          severity,
          message,
          JSON.stringify(details),
          userId,
          req?.ip || null,
          req?.headers?.['user-agent'] || null
        ]
      );
    } catch (error) {
      console.error('Database logging error:', error);
    }
  }

  async logToFile(type, severity, message, details, userId, req) {
    try {
      const logDir = path.resolve(process.env.LOG_FILE_PATH || './logs');
      await fs.mkdir(logDir, { recursive: true });
      
      const date = new Date();
      const filename = `${date.toISOString().split('T')[0]}-${type}.log`;
      const filepath = path.join(logDir, filename);
      
      const logEntry = {
        timestamp: date.toISOString(),
        type,
        severity,
        message,
        details,
        userId,
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent']
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(filepath, logLine);
    } catch (error) {
      console.error('File logging error:', error);
    }
  }

  logToConsole(type, severity, message, details) {
    const timestamp = new Date().toISOString();
    const color = this.getColorForSeverity(severity);
    console.log(`${color}[${timestamp}] [${type}] [${severity.toUpperCase()}] ${message}`, details, '\x1b[0m');
  }

  getColorForSeverity(severity) {
    const colors = {
      debug: '\x1b[36m',    // Cyan
      info: '\x1b[32m',     // Green
      warn: '\x1b[33m',     // Yellow
      error: '\x1b[31m',    // Red
      critical: '\x1b[35m'  // Magenta
    };
    return colors[severity] || '\x1b[0m';
  }

  // Convenience methods
  async debug(message, details = {}, userId = null, req = null) {
    await this.log(this.logTypes.SYSTEM, 'debug', message, details, userId, req);
  }

  async info(message, details = {}, userId = null, req = null) {
    await this.log(this.logTypes.SYSTEM, 'info', message, details, userId, req);
  }

  async warn(message, details = {}, userId = null, req = null) {
    await this.log(this.logTypes.SYSTEM, 'warn', message, details, userId, req);
  }

  async error(message, details = {}, userId = null, req = null) {
    await this.log(this.logTypes.ERROR, 'error', message, details, userId, req);
  }

  async critical(message, details = {}, userId = null, req = null) {
    await this.log(this.logTypes.ERROR, 'critical', message, details, userId, req);
  }

  // Specialized logging methods
  async logAuth(action, success, details = {}, userId = null, req = null) {
    const severity = success ? 'info' : 'warn';
    const message = `Authentication ${action}: ${success ? 'Success' : 'Failed'}`;
    await this.log(this.logTypes.AUTH, severity, message, details, userId, req);
  }

  async logAdminAction(action, details = {}, adminId, req = null) {
    await this.log(this.logTypes.ADMIN, 'info', `Admin action: ${action}`, details, adminId, req);
  }

  async logSecurityEvent(event, severity = 'warn', details = {}, userId = null, req = null) {
    await this.log(this.logTypes.SECURITY, severity, `Security event: ${event}`, details, userId, req);
  }

  async logApiRequest(method, path, statusCode, responseTime, userId = null, req = null) {
    const severity = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    await this.log(
      this.logTypes.API,
      severity,
      `${method} ${path} - ${statusCode}`,
      { responseTime, statusCode },
      userId,
      req
    );
  }

  // Audit trail helper
  async createAuditEntry(userId, activityType, activityData) {
    try {
      await db.query(
        'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
        [userId, activityType, JSON.stringify(activityData)]
      );
    } catch (error) {
      console.error('Audit entry creation error:', error);
    }
  }

  // Log rotation helper
  async rotateLogs(daysToKeep = 30) {
    try {
      const logDir = path.resolve(process.env.LOG_FILE_PATH || './logs');
      const files = await fs.readdir(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            await this.info(`Rotated old log file: ${file}`);
          }
        }
      }
      
      // Also clean old database logs
      await db.query(
        'DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL $1',
        [`${daysToKeep} days`]
      );
    } catch (error) {
      console.error('Log rotation error:', error);
    }
  }
}

// Export singleton instance
module.exports = new SystemLogger();