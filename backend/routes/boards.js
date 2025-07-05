const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all boards
router.get('/', async (req, res) => {
  try {
    const boards = await db.query('SELECT * FROM boards WHERE is_active = true ORDER BY name');
    res.json(boards.rows);
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get board by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const board = await db.query('SELECT * FROM boards WHERE id = $1 AND is_active = true', [id]);
    
    if (board.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    res.json(board.rows[0]);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a board
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const messages = await db.query(`
      SELECT m.*, u.display_name, u.username,
             (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id AND r.is_deleted = false) as reply_count
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.board_id = $1 AND m.is_deleted = false AND m.parent_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);
    
    const totalCount = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE board_id = $1 AND is_deleted = false AND parent_id IS NULL',
      [id]
    );
    
    res.json({
      messages: messages.rows,
      total: parseInt(totalCount.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(totalCount.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching board messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Post new message to board
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, subject, content } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({ error: 'User ID and content are required' });
    }
    
    // Verify board exists
    const board = await db.query('SELECT id FROM boards WHERE id = $1 AND is_active = true', [id]);
    if (board.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    const result = await db.query(
      'INSERT INTO messages (user_id, board_id, subject, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, id, subject, content]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error posting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;