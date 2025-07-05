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
        user_level INTEGER DEFAULT 1,
        is_admin BOOLEAN DEFAULT false,
        role VARCHAR(50) DEFAULT 'user'
      )
    `);

    // Add columns if they don't exist (for existing databases)
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false
    `).catch(() => {});
    
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
    `).catch(() => {});

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

    // ANSI art tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ansi_art_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ansi_art (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        width INTEGER,
        height INTEGER,
        title VARCHAR(255),
        artist VARCHAR(100),
        group_name VARCHAR(100),
        year INTEGER,
        description TEXT,
        category_id INTEGER REFERENCES ansi_art_categories(id) ON DELETE SET NULL,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        view_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_deleted BOOLEAN DEFAULT false,
        sauce_info JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default ANSI art categories
    await pool.query(`
      INSERT INTO ansi_art_categories (name, description, display_order) VALUES
      ('Welcome Screens', 'Welcome and login screens', 1),
      ('Main Menus', 'Main menu screens', 2),
      ('Headers', 'Section headers and banners', 3),
      ('Footers', 'Footer graphics', 4),
      ('Backgrounds', 'Background patterns and screens', 5),
      ('Logos', 'BBS and group logos', 6),
      ('Transitions', 'Screen transition graphics', 7),
      ('Info Screens', 'Information and help screens', 8),
      ('User Lists', 'User listing decorations', 9),
      ('File Lists', 'File area decorations', 10),
      ('Message Areas', 'Message area headers', 11),
      ('Special Events', 'Holiday and special event screens', 12),
      ('ASCII Art', 'ASCII-based artwork', 13),
      ('Misc', 'Miscellaneous ANSI art', 99)
      ON CONFLICT (name) DO NOTHING
    `);

    // Menu builder tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menus (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        width INTEGER DEFAULT 80,
        height INTEGER DEFAULT 25,
        background_color INTEGER DEFAULT 0,
        foreground_color INTEGER DEFAULT 7,
        is_active BOOLEAN DEFAULT true,
        is_main_menu BOOLEAN DEFAULT false,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        menu_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
        hotkey CHAR(1) NOT NULL,
        label VARCHAR(100) NOT NULL,
        x_position INTEGER NOT NULL,
        y_position INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        action_type VARCHAR(50) NOT NULL, -- 'submenu', 'command', 'script', 'external'
        action_data JSONB, -- stores command, submenu_id, script path, etc.
        foreground_color INTEGER DEFAULT 7,
        background_color INTEGER DEFAULT 0,
        highlight_fg_color INTEGER DEFAULT 0,
        highlight_bg_color INTEGER DEFAULT 7,
        is_visible BOOLEAN DEFAULT true,
        min_user_level INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(menu_id, hotkey)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_layouts (
        id SERIAL PRIMARY KEY,
        menu_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
        grid_data JSONB NOT NULL, -- stores the 80x25 grid with characters and colors
        box_elements JSONB, -- stores box drawing elements positions
        text_elements JSONB, -- stores text elements with positions
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        category VARCHAR(50),
        template_data JSONB NOT NULL,
        preview_image TEXT,
        is_public BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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