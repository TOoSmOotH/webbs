#!/usr/bin/env node

const db = require('../config/database');
const bcrypt = require('bcrypt');

async function initializeAdminTables() {
  console.log('Initializing admin tables...');
  
  try {
    // Add is_approved column to files table
    await db.query(`
      ALTER TABLE files
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id)
    `).catch(() => console.log('File approval columns may already exist'));
    
    // Create system_settings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        category VARCHAR(50),
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('Created system_settings table');
    
    // Create system_logs table
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
    `);
    console.log('Created system_logs table');
    
    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
      CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
      CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
    `).catch(() => console.log('Some indexes may already exist'));
    
    // Insert default system settings
    const defaultSettings = [
      {
        key: 'site_name',
        value: { value: 'WebBBS' },
        category: 'general',
        description: 'The name of your BBS'
      },
      {
        key: 'site_description',
        value: { value: 'A modern web-based BBS system' },
        category: 'general',
        description: 'Site description'
      },
      {
        key: 'enable_file_approval',
        value: { value: false },
        category: 'files',
        description: 'Require admin approval for uploaded files'
      },
      {
        key: 'max_upload_size',
        value: { value: 104857600 },
        category: 'files',
        description: 'Maximum file upload size in bytes'
      },
      {
        key: 'enable_user_registration',
        value: { value: true },
        category: 'users',
        description: 'Allow new user registration'
      },
      {
        key: 'min_password_length',
        value: { value: 8 },
        category: 'security',
        description: 'Minimum password length'
      },
      {
        key: 'session_timeout',
        value: { value: 3600 },
        category: 'security',
        description: 'Session timeout in seconds'
      },
      {
        key: 'enable_audit_log',
        value: { value: true },
        category: 'logging',
        description: 'Enable detailed audit logging'
      },
      {
        key: 'log_retention_days',
        value: { value: 30 },
        category: 'logging',
        description: 'Number of days to retain logs'
      }
    ];
    
    for (const setting of defaultSettings) {
      await db.query(
        `INSERT INTO system_settings (key, value, category, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING`,
        [setting.key, JSON.stringify(setting.value), setting.category, setting.description]
      );
    }
    console.log('Inserted default system settings');
    
    // Create default super admin if not exists
    const adminCheck = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [process.env.DEFAULT_ADMIN_USERNAME || 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      const passwordHash = await bcrypt.hash(
        process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123',
        10
      );
      
      await db.query(
        `INSERT INTO users (username, email, password_hash, display_name, is_admin, role, user_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          process.env.DEFAULT_ADMIN_USERNAME || 'admin',
          process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
          passwordHash,
          'System Administrator',
          true,
          'super_admin',
          100
        ]
      );
      console.log('Created default super admin user');
      console.log('Username:', process.env.DEFAULT_ADMIN_USERNAME || 'admin');
      console.log('Password:', process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123');
      console.log('*** PLEASE CHANGE THE DEFAULT PASSWORD ***');
    }
    
    console.log('Admin tables initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing admin tables:', error);
    process.exit(1);
  }
}

// Run initialization
initializeAdminTables();