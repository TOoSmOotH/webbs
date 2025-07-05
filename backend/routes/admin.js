const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../config/database');
const { adminAuth, requireRole, generateAdminToken } = require('../middleware/adminAuth');

// Admin login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find admin user
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true AND is_admin = true',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials or insufficient privileges' });
    }
    
    const admin = result.rows[0];
    
    // Verify password
    const passwordValid = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials or insufficient privileges' });
    }
    
    // Generate JWT token
    const token = generateAdminToken(admin);
    
    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [admin.id]);
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [admin.id, 'admin_login', { username, ip: req.ip }]
    );
    
    res.json({
      success: true,
      message: 'Admin login successful',
      user: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name,
        email: admin.email,
        role: admin.role
      },
      token
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT id, username, email, display_name, created_at, last_login, 
             is_active, user_level, is_admin, role
      FROM users
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM users';
    const params = [];
    
    if (search) {
      query += ' WHERE username ILIKE $1 OR email ILIKE $1 OR display_name ILIKE $1';
      countQuery += ' WHERE username ILIKE $1 OR email ILIKE $1 OR display_name ILIKE $1';
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const [users, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, search ? [`%${search}%`] : [])
    ]);
    
    res.json({
      users: users.rows,
      total: parseInt(count.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get ANSI art for admin panel
router.get('/ansi-art', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', category_id } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT a.*, c.name as category_name, u.username as uploaded_by_username
      FROM ansi_art a
      LEFT JOIN ansi_art_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.is_deleted = false
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM ansi_art WHERE is_deleted = false';
    const params = [];
    let paramIndex = 0;
    
    if (search) {
      paramIndex++;
      query += ` AND (
        a.title ILIKE $${paramIndex} OR 
        a.artist ILIKE $${paramIndex} OR 
        a.group_name ILIKE $${paramIndex} OR
        a.original_filename ILIKE $${paramIndex}
      )`;
      countQuery += ` AND (
        title ILIKE $1 OR 
        artist ILIKE $1 OR 
        group_name ILIKE $1 OR
        original_filename ILIKE $1
      )`;
      params.push(`%${search}%`);
    }
    
    if (category_id) {
      paramIndex++;
      query += ` AND a.category_id = $${paramIndex}`;
      countQuery += ` AND category_id = $${params.length + 1}`;
      params.push(category_id);
    }
    
    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const [artResults, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, search ? [`%${search}%`, ...(category_id ? [category_id] : [])] : (category_id ? [category_id] : []))
    ]);
    
    res.json({
      ansiArt: artResults.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching ANSI art:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, user_level, is_admin, role } = req.body;
    
    // Don't allow admins to remove their own admin status
    if (parseInt(id) === req.admin.id && is_admin === false) {
      return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    if (user_level !== undefined) {
      updates.push(`user_level = $${paramCount++}`);
      values.push(user_level);
    }
    
    if (is_admin !== undefined) {
      updates.push(`is_admin = $${paramCount++}`);
      values.push(is_admin);
    }
    
    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    values.push(id);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, display_name, is_active, user_level, is_admin, role
    `;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_user_update', { 
        target_user_id: id, 
        updates: req.body,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (super admin only)
router.delete('/users/:id', requireRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Don't allow admins to delete themselves
    if (parseInt(id) === req.admin.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Check if user exists
    const userCheck = await db.query('SELECT username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user (cascade will handle related records)
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_user_delete', { 
        deleted_user_id: id,
        deleted_username: userCheck.rows[0].username,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system statistics (admin only)
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query('SELECT COUNT(*) as active FROM users WHERE is_active = true'),
      db.query('SELECT COUNT(*) as admins FROM users WHERE is_admin = true'),
      db.query('SELECT COUNT(*) as total FROM messages'),
      db.query('SELECT COUNT(*) as total FROM files'),
      db.query('SELECT COUNT(*) as active_sessions FROM sessions WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP')
    ]);
    
    res.json({
      users: {
        total: parseInt(stats[0].rows[0].total),
        active: parseInt(stats[1].rows[0].active),
        admins: parseInt(stats[2].rows[0].admins)
      },
      messages: {
        total: parseInt(stats[3].rows[0].total)
      },
      files: {
        total: parseInt(stats[4].rows[0].total)
      },
      sessions: {
        active: parseInt(stats[5].rows[0].active_sessions)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent activity (admin only)
router.get('/activity', adminAuth, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const result = await db.query(`
      SELECT ua.*, u.username, u.display_name
      FROM user_activity ua
      JOIN users u ON ua.user_id = u.id
      ORDER BY ua.created_at DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      activities: result.rows
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create admin user (super admin only)
router.post('/create-admin', requireRole(['super_admin']), async (req, res) => {
  try {
    const { username, email, password, display_name, role = 'admin' } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create admin user
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin, role, user_level) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, username, email, display_name, is_admin, role`,
      [username, email, passwordHash, display_name || username, true, role, 100]
    );
    
    const newAdmin = result.rows[0];
    
    // Log activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_created', { 
        new_admin_id: newAdmin.id,
        new_admin_username: newAdmin.username,
        created_by: req.admin.username
      }]
    );
    
    res.json({
      success: true,
      message: 'Admin user created successfully',
      admin: newAdmin
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================== BOARD MANAGEMENT ENDPOINTS ===================

// Get all boards with statistics (admin only)
router.get('/boards', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', showInactive = false } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        b.*,
        COUNT(DISTINCT m.id) as message_count,
        COUNT(DISTINCT m.user_id) as unique_posters,
        MAX(m.created_at) as last_activity
      FROM boards b
      LEFT JOIN messages m ON b.id = m.board_id AND m.is_deleted = false
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM boards';
    const params = [];
    let whereConditions = [];
    
    if (!showInactive) {
      whereConditions.push('b.is_active = true');
    }
    
    if (search) {
      params.push(`%${search}%`);
      whereConditions.push(`(b.name ILIKE $${params.length} OR b.description ILIKE $${params.length})`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' GROUP BY b.id ORDER BY b.created_at DESC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const [boards, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, search ? [`%${search}%`] : [])
    ]);
    
    res.json({
      boards: boards.rows,
      total: parseInt(count.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// Create new board (admin only)
router.post('/boards', adminAuth, async (req, res) => {
  try {
    const { name, description, min_user_level = 1, is_active = true } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Board name is required' });
    }
    
    // Check if board name already exists
    const existing = await db.query('SELECT id FROM boards WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Board name already exists' });
    }
    
    const result = await db.query(
      `INSERT INTO boards (name, description, min_user_level, is_active) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, description, min_user_level, is_active]
    );
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_board_create', { 
        board_id: result.rows[0].id,
        board_name: name,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      board: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating board:', error);
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// Update board (admin only)
router.put('/boards/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, min_user_level, is_active } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      // Check if new name conflicts with existing board
      const existing = await db.query(
        'SELECT id FROM boards WHERE name = $1 AND id != $2',
        [name, id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Board name already exists' });
      }
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    
    if (min_user_level !== undefined) {
      updates.push(`min_user_level = $${paramCount++}`);
      values.push(min_user_level);
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    values.push(id);
    const query = `
      UPDATE boards 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_board_update', { 
        board_id: id,
        updates: req.body,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      board: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating board:', error);
    res.status(500).json({ error: 'Failed to update board' });
  }
});

// Delete board (super admin only)
router.delete('/boards/:id', requireRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { moveMessagesTo } = req.body;
    
    // Check if board exists
    const boardCheck = await db.query('SELECT name FROM boards WHERE id = $1', [id]);
    if (boardCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // If moveMessagesTo is provided, move messages to another board
    if (moveMessagesTo) {
      const targetBoard = await db.query('SELECT id FROM boards WHERE id = $1', [moveMessagesTo]);
      if (targetBoard.rows.length === 0) {
        return res.status(400).json({ error: 'Target board not found' });
      }
      
      await db.query('UPDATE messages SET board_id = $1 WHERE board_id = $2', [moveMessagesTo, id]);
    }
    
    // Delete board (cascade will handle messages if not moved)
    await db.query('DELETE FROM boards WHERE id = $1', [id]);
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_board_delete', { 
        deleted_board_id: id,
        deleted_board_name: boardCheck.rows[0].name,
        messages_moved_to: moveMessagesTo,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      message: 'Board deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

// =================== FILE MANAGEMENT ENDPOINTS ===================

// Get all files with detailed info (admin only)
router.get('/files', adminAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      area_id, 
      board_id,
      showDeleted = false,
      needsApproval = false
    } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        f.*,
        fa.name as area_name,
        b.name as board_name,
        u.username as uploader_username
      FROM files f
      LEFT JOIN file_areas fa ON f.file_area_id = fa.id
      LEFT JOIN boards b ON f.board_id = b.id
      LEFT JOIN users u ON f.uploaded_by = u.id
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM files f';
    const params = [];
    let whereConditions = [];
    
    if (!showDeleted) {
      whereConditions.push('f.is_deleted = false');
    }
    
    if (needsApproval) {
      whereConditions.push('f.is_approved = false');
    }
    
    if (search) {
      params.push(`%${search}%`);
      whereConditions.push(`(
        f.original_filename ILIKE $${params.length} OR 
        f.description ILIKE $${params.length}
      )`);
    }
    
    if (area_id) {
      params.push(area_id);
      whereConditions.push(`f.file_area_id = $${params.length}`);
    }
    
    if (board_id) {
      params.push(board_id);
      whereConditions.push(`f.board_id = $${params.length}`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY f.created_at DESC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const [files, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);
    
    res.json({
      files: files.rows,
      total: parseInt(count.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Approve/reject file (admin only)
router.put('/files/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, reason } = req.body;
    
    // First add the is_approved column if it doesn't exist
    await db.query(`
      ALTER TABLE files
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id)
    `).catch(() => {});
    
    const result = await db.query(
      `UPDATE files 
       SET is_approved = $1, approval_date = CURRENT_TIMESTAMP, approved_by = $2
       WHERE id = $3
       RETURNING *`,
      [approved, req.admin.id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, approved ? 'admin_file_approve' : 'admin_file_reject', { 
        file_id: id,
        filename: result.rows[0].original_filename,
        reason: reason,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving file:', error);
    res.status(500).json({ error: 'Failed to approve file' });
  }
});

// Permanently delete file (super admin only)
router.delete('/files/:id/permanent', requireRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get file info
    const fileResult = await db.query(
      'SELECT * FROM files WHERE id = $1',
      [id]
    );
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = fileResult.rows[0];
    
    // Delete physical file
    const fs = require('fs').promises;
    const path = require('path');
    const filePath = path.join(__dirname, '../uploads', file.file_path);
    
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error('Error deleting physical file:', err);
    }
    
    // Delete database record
    await db.query('DELETE FROM files WHERE id = $1', [id]);
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_file_permanent_delete', { 
        file_id: id,
        filename: file.original_filename,
        file_path: file.file_path,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      message: 'File permanently deleted'
    });
  } catch (error) {
    console.error('Error permanently deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Manage file areas (admin only)
router.get('/file-areas', adminAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        fa.*,
        COUNT(f.id) as file_count,
        SUM(f.file_size) as total_size
      FROM file_areas fa
      LEFT JOIN files f ON fa.id = f.file_area_id AND f.is_deleted = false
      GROUP BY fa.id
      ORDER BY fa.name
    `);
    
    res.json({
      areas: result.rows
    });
  } catch (error) {
    console.error('Error fetching file areas:', error);
    res.status(500).json({ error: 'Failed to fetch file areas' });
  }
});

// Create file area (admin only)
router.post('/file-areas', adminAuth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      min_user_level = 1, 
      max_file_size = 104857600, 
      allowed_extensions = [],
      is_active = true 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Area name is required' });
    }
    
    const result = await db.query(
      `INSERT INTO file_areas 
       (name, description, min_user_level, max_file_size, allowed_extensions, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, min_user_level, max_file_size, allowed_extensions, is_active]
    );
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_file_area_create', { 
        area_id: result.rows[0].id,
        area_name: name,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      area: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating file area:', error);
    res.status(500).json({ error: 'Failed to create file area' });
  }
});

// Update file area (admin only)
router.put('/file-areas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    const allowedFields = ['name', 'description', 'min_user_level', 'max_file_size', 'allowed_extensions', 'is_active'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        values.push(req.body[field]);
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    values.push(id);
    const query = `
      UPDATE file_areas 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File area not found' });
    }
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_file_area_update', { 
        area_id: id,
        updates: req.body,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      area: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating file area:', error);
    res.status(500).json({ error: 'Failed to update file area' });
  }
});

// =================== SYSTEM SETTINGS ENDPOINTS ===================

// Get system settings (admin only)
router.get('/settings', adminAuth, async (req, res) => {
  try {
    // First create settings table if it doesn't exist
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
    
    // Get all settings
    const result = await db.query(
      'SELECT * FROM system_settings ORDER BY category, key'
    );
    
    // Group by category
    const settings = {};
    result.rows.forEach(row => {
      const category = row.category || 'general';
      if (!settings[category]) {
        settings[category] = {};
      }
      settings[category][row.key] = {
        value: row.value,
        description: row.description,
        updated_at: row.updated_at
      };
    });
    
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update system setting (admin only)
router.put('/settings/:key', adminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, category = 'general', description } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    const result = await db.query(
      `INSERT INTO system_settings (key, value, category, description, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE
       SET value = $2, category = $3, description = $4, 
           updated_at = CURRENT_TIMESTAMP, updated_by = $5
       RETURNING *`,
      [key, JSON.stringify(value), category, description, req.admin.id]
    );
    
    // Log admin activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_setting_update', { 
        setting_key: key,
        new_value: value,
        admin_username: req.admin.username 
      }]
    );
    
    res.json({
      success: true,
      setting: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Get system configuration (admin only)
router.get('/config', adminAuth, async (req, res) => {
  try {
    const config = {
      database: {
        connected: true,
        version: (await db.query('SELECT version()')).rows[0].version
      },
      node: {
        version: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3001
      }
    };
    
    res.json({ config });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// =================== LOGGING AND MONITORING ENDPOINTS ===================

// Get system logs (admin only)
router.get('/logs', adminAuth, async (req, res) => {
  try {
    const { 
      type = 'all', 
      severity = 'all',
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      userId
    } = req.query;
    
    // First create logs table if it doesn't exist
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
    
    let query = 'SELECT l.*, u.username FROM system_logs l LEFT JOIN users u ON l.user_id = u.id';
    const params = [];
    let whereConditions = [];
    
    if (type !== 'all') {
      params.push(type);
      whereConditions.push(`l.log_type = $${params.length}`);
    }
    
    if (severity !== 'all') {
      params.push(severity);
      whereConditions.push(`l.severity = $${params.length}`);
    }
    
    if (startDate) {
      params.push(startDate);
      whereConditions.push(`l.created_at >= $${params.length}`);
    }
    
    if (endDate) {
      params.push(endDate);
      whereConditions.push(`l.created_at <= $${params.length}`);
    }
    
    if (userId) {
      params.push(userId);
      whereConditions.push(`l.user_id = $${params.length}`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY l.created_at DESC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    res.json({
      logs: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get audit trail (admin only)
router.get('/audit', adminAuth, async (req, res) => {
  try {
    const { 
      user_id,
      activity_type,
      limit = 100,
      offset = 0,
      startDate,
      endDate
    } = req.query;
    
    let query = `
      SELECT ua.*, u.username, u.display_name
      FROM user_activity ua
      JOIN users u ON ua.user_id = u.id
    `;
    
    const params = [];
    let whereConditions = [];
    
    if (user_id) {
      params.push(user_id);
      whereConditions.push(`ua.user_id = $${params.length}`);
    }
    
    if (activity_type) {
      params.push(activity_type);
      whereConditions.push(`ua.activity_type = $${params.length}`);
    }
    
    if (startDate) {
      params.push(startDate);
      whereConditions.push(`ua.created_at >= $${params.length}`);
    }
    
    if (endDate) {
      params.push(endDate);
      whereConditions.push(`ua.created_at <= $${params.length}`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY ua.created_at DESC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    res.json({
      audit_trail: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// Get performance metrics (admin only)
router.get('/metrics', adminAuth, async (req, res) => {
  try {
    const metrics = {
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      database: {
        activeConnections: (await db.query(
          "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"
        )).rows[0].count,
        databaseSize: (await db.query(
          "SELECT pg_database_size(current_database()) as size"
        )).rows[0].size
      },
      usage: {
        totalUsers: (await db.query('SELECT COUNT(*) FROM users')).rows[0].count,
        activeUsers24h: (await db.query(
          'SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE created_at > NOW() - INTERVAL \'24 hours\''
        )).rows[0].count,
        totalMessages: (await db.query('SELECT COUNT(*) FROM messages')).rows[0].count,
        messagesLast24h: (await db.query(
          'SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL \'24 hours\''
        )).rows[0].count,
        totalFiles: (await db.query('SELECT COUNT(*) FROM files')).rows[0].count,
        totalFileSize: (await db.query(
          'SELECT SUM(file_size) FROM files WHERE is_deleted = false'
        )).rows[0].sum || 0
      }
    };
    
    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Export system data (super admin only)
router.get('/export/:type', requireRole(['super_admin']), async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['users', 'messages', 'files', 'boards', 'activity', 'full'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid export type' });
    }
    
    let data = {};
    
    if (type === 'users' || type === 'full') {
      data.users = (await db.query(
        'SELECT id, username, email, display_name, created_at, last_login, is_active, user_level, is_admin, role FROM users'
      )).rows;
    }
    
    if (type === 'messages' || type === 'full') {
      data.messages = (await db.query(
        'SELECT * FROM messages WHERE is_deleted = false'
      )).rows;
    }
    
    if (type === 'files' || type === 'full') {
      data.files = (await db.query(
        'SELECT id, original_filename, file_size, description, uploaded_by, created_at FROM files WHERE is_deleted = false'
      )).rows;
    }
    
    if (type === 'boards' || type === 'full') {
      data.boards = (await db.query('SELECT * FROM boards')).rows;
    }
    
    if (type === 'activity' || type === 'full') {
      data.activity = (await db.query(
        'SELECT * FROM user_activity ORDER BY created_at DESC LIMIT 10000'
      )).rows;
    }
    
    // Log export activity
    await db.query(
      'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
      [req.admin.id, 'admin_data_export', { 
        export_type: type,
        admin_username: req.admin.username,
        timestamp: new Date()
      }]
    );
    
    res.json({
      export_type: type,
      exported_at: new Date(),
      exported_by: req.admin.username,
      data
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Log system event (internal helper)
const logSystemEvent = async (type, severity, message, details = {}, userId = null, req = null) => {
  try {
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
        req?.headers['user-agent'] || null
      ]
    );
  } catch (error) {
    console.error('Error logging system event:', error);
  }
};

// Export helper for other modules to use
router.logSystemEvent = logSystemEvent;

module.exports = router;