const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'webbs',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Initialize database schema
const initializeDatabase = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        user_level INTEGER DEFAULT 1
      )
    `);

    // Sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Messages/Posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        board_id INTEGER,
        parent_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        subject VARCHAR(255),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false
      )
    `);

    // Boards table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        min_user_level INTEGER DEFAULT 1
      )
    `);

    // Private messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(255),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false
      )
    `);

    // User activity table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        activity_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Files table with support for modern long filenames
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100),
        description TEXT,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
        download_count INTEGER DEFAULT 0,
        is_public BOOLEAN DEFAULT true,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_downloaded TIMESTAMP,
        checksum VARCHAR(64),
        metadata JSONB
      )
    `);

    // File areas/categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_areas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        min_user_level INTEGER DEFAULT 1,
        max_file_size BIGINT DEFAULT 104857600, -- 100MB default
        allowed_extensions TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add file_area_id to files table
    await pool.query(`
      ALTER TABLE files
      ADD COLUMN IF NOT EXISTS file_area_id INTEGER REFERENCES file_areas(id) ON DELETE SET NULL
    `).catch(() => {});

    // Add foreign key constraint for messages board_id
    await pool.query(`
      ALTER TABLE messages
      ADD CONSTRAINT fk_messages_board_id
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    `).catch(() => {}); // Ignore if constraint already exists

    // Insert default boards if they don't exist
    await pool.query(`
      INSERT INTO boards (name, description) VALUES
      ('General', 'General discussion board'),
      ('Technology', 'Technology and programming discussions'),
      ('Gaming', 'Gaming discussions and reviews'),
      ('Off-Topic', 'Off-topic discussions')
      ON CONFLICT (name) DO NOTHING
    `);

    // Insert default file areas if they don't exist
    await pool.query(`
      INSERT INTO file_areas (name, description, allowed_extensions) VALUES
      ('General Files', 'General file uploads', ARRAY['txt', 'doc', 'docx', 'pdf', 'zip', 'rar', '7z']),
      ('Images', 'Image files', ARRAY['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']),
      ('Software', 'Software and utilities', ARRAY['exe', 'zip', 'rar', '7z', 'tar', 'gz', 'dmg', 'deb', 'rpm']),
      ('Media', 'Audio and video files', ARRAY['mp3', 'wav', 'ogg', 'mp4', 'avi', 'mkv', 'webm']),
      ('Documents', 'Text documents and e-books', ARRAY['txt', 'pdf', 'doc', 'docx', 'epub', 'mobi'])
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('Database schema initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

// Initialize on startup
initializeDatabase();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};