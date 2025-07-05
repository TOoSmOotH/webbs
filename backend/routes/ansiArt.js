const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const db = require('../config/database');
const { adminAuth } = require('../middleware/adminAuth');
const { ansiToHtml } = require('../utils/ansiToHtml');

// Configure multer for ANSI art storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join(__dirname, '../uploads/ansi_art/temp');
    await fs.mkdir(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for ANSI/ASCII art files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.ans', '.asc', '.txt', '.nfo', '.diz'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedExtensions.join(', ')}`), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for ANSI files
    files: 1
  },
  fileFilter: fileFilter
});

// Helper function to parse SAUCE record from ANSI file
const parseSAUCE = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size < 128) return null;

    const buffer = Buffer.alloc(128);
    const fd = await fs.open(filePath, 'r');
    await fd.read(buffer, 0, 128, stats.size - 128);
    await fd.close();

    // Check for SAUCE header
    if (buffer.toString('ascii', 0, 5) !== 'SAUCE') return null;

    const sauce = {
      id: buffer.toString('ascii', 0, 5),
      version: buffer.toString('ascii', 5, 7),
      title: buffer.toString('ascii', 7, 42).replace(/\0+$/, '').trim(),
      author: buffer.toString('ascii', 42, 62).replace(/\0+$/, '').trim(),
      group: buffer.toString('ascii', 62, 82).replace(/\0+$/, '').trim(),
      date: buffer.toString('ascii', 82, 90).replace(/\0+$/, '').trim(),
      fileSize: buffer.readUInt32LE(90),
      dataType: buffer.readUInt8(94),
      fileType: buffer.readUInt8(95),
      tInfo1: buffer.readUInt16LE(96),
      tInfo2: buffer.readUInt16LE(98),
      tInfo3: buffer.readUInt16LE(100),
      tInfo4: buffer.readUInt16LE(102),
      comments: buffer.readUInt8(104),
      flags: buffer.readUInt8(105),
      filler: buffer.toString('ascii', 106, 128)
    };

    // Parse date
    if (sauce.date) {
      const year = parseInt(sauce.date.substring(0, 4));
      const month = parseInt(sauce.date.substring(4, 6));
      const day = parseInt(sauce.date.substring(6, 8));
      if (year && month && day) {
        sauce.parsedDate = new Date(year, month - 1, day);
      }
    }

    // Get width/height for character-based files
    if (sauce.dataType === 1) { // Character based
      sauce.width = sauce.tInfo1 || 80;
      sauce.height = sauce.tInfo2 || 25;
    }

    return sauce;
  } catch (error) {
    console.error('Error parsing SAUCE:', error);
    return null;
  }
};

// Upload ANSI art file
router.post('/upload', adminAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { file } = req;
    const { 
      category_id,
      title,
      artist,
      group_name,
      year,
      description
    } = req.body;

    // Parse SAUCE record if present
    const sauce = await parseSAUCE(file.path);

    // Move file to proper directory
    const categoryResult = await db.query(
      'SELECT name FROM ansi_art_categories WHERE id = $1',
      [category_id || 14] // Default to 'Misc' category
    );
    
    const categoryName = categoryResult.rows[0]?.name || 'Misc';
    const categoryDir = categoryName.toLowerCase().replace(/\s+/g, '_');
    const finalDir = path.join(__dirname, '../uploads/ansi_art', categoryDir);
    await fs.mkdir(finalDir, { recursive: true });
    
    const finalPath = path.join(finalDir, file.filename);
    await fs.rename(file.path, finalPath);

    // Store in database
    const result = await db.query(
      `INSERT INTO ansi_art (
        filename, original_filename, file_path, file_size,
        width, height, title, artist, group_name, year,
        description, category_id, uploaded_by, sauce_info, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        file.filename,
        file.originalname,
        path.relative(path.join(__dirname, '../uploads/ansi_art'), finalPath),
        file.size,
        sauce?.width || null,
        sauce?.height || null,
        title || sauce?.title || null,
        artist || sauce?.author || null,
        group_name || sauce?.group || null,
        year || (sauce?.parsedDate ? sauce.parsedDate.getFullYear() : null),
        description || null,
        category_id || 14,
        req.user.id,
        sauce ? JSON.stringify(sauce) : null,
        JSON.stringify({
          uploadedAt: new Date(),
          mimeType: file.mimetype,
          originalSize: file.size
        })
      ]
    );

    res.json({
      success: true,
      ansiArt: result.rows[0]
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file if it exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {}
    }
    
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// Get ANSI art list
router.get('/list', async (req, res) => {
  try {
    const { 
      category_id,
      search,
      limit = 50,
      offset = 0,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    let query = `
      SELECT a.*, c.name as category_name
      FROM ansi_art a
      LEFT JOIN ansi_art_categories c ON a.category_id = c.id
      WHERE a.is_deleted = false AND a.is_active = true
    `;
    const params = [];
    let paramCount = 0;

    if (category_id) {
      params.push(category_id);
      query += ` AND a.category_id = $${++paramCount}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const searchParam = `$${++paramCount}`;
      query += ` AND (
        a.title ILIKE ${searchParam} OR 
        a.artist ILIKE ${searchParam} OR 
        a.group_name ILIKE ${searchParam} OR
        a.original_filename ILIKE ${searchParam}
      )`;
    }

    // Add sorting
    const allowedSorts = ['created_at', 'title', 'artist', 'year', 'view_count'];
    const sortField = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY a.${sortField} ${sortOrder}`;

    // Add pagination
    params.push(limit);
    query += ` LIMIT $${++paramCount}`;
    params.push(offset);
    query += ` OFFSET $${++paramCount}`;

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM ansi_art a
      WHERE a.is_deleted = false AND a.is_active = true
    `;
    const countParams = [];
    paramCount = 0;

    if (category_id) {
      countParams.push(category_id);
      countQuery += ` AND a.category_id = $${++paramCount}`;
    }

    if (search) {
      countParams.push(`%${search}%`);
      const searchParam = `$${++paramCount}`;
      countQuery += ` AND (
        a.title ILIKE ${searchParam} OR 
        a.artist ILIKE ${searchParam} OR 
        a.group_name ILIKE ${searchParam} OR
        a.original_filename ILIKE ${searchParam}
      )`;
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      ansiArt: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < totalCount
      }
    });

  } catch (error) {
    console.error('List ANSI art error:', error);
    res.status(500).json({ error: 'Failed to list ANSI art' });
  }
});

// Get single ANSI art details
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, c.name as category_name
       FROM ansi_art a
       LEFT JOIN ansi_art_categories c ON a.category_id = c.id
       WHERE a.id = $1 AND a.is_deleted = false`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ANSI art not found' });
    }

    // Update view count
    await db.query(
      'UPDATE ansi_art SET view_count = view_count + 1 WHERE id = $1',
      [req.params.id]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get ANSI art error:', error);
    res.status(500).json({ error: 'Failed to get ANSI art' });
  }
});

// Get raw ANSI file
router.get('/:id/raw', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT file_path, original_filename FROM ansi_art WHERE id = $1 AND is_deleted = false',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ANSI art not found' });
    }

    const file = result.rows[0];
    const filePath = path.join(__dirname, '../uploads/ansi_art', file.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/plain; charset=cp437');
    res.setHeader('Content-Disposition', `inline; filename="${file.original_filename}"`);
    
    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Get raw ANSI error:', error);
    res.status(500).json({ error: 'Failed to get ANSI file' });
  }
});

// Update ANSI art metadata
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { 
      title,
      artist,
      group_name,
      year,
      description,
      category_id,
      is_active
    } = req.body;

    const result = await db.query(
      `UPDATE ansi_art SET
        title = COALESCE($1, title),
        artist = COALESCE($2, artist),
        group_name = COALESCE($3, group_name),
        year = COALESCE($4, year),
        description = COALESCE($5, description),
        category_id = COALESCE($6, category_id),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND is_deleted = false
      RETURNING *`,
      [title, artist, group_name, year, description, category_id, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ANSI art not found' });
    }

    res.json({
      success: true,
      ansiArt: result.rows[0]
    });

  } catch (error) {
    console.error('Update ANSI art error:', error);
    res.status(500).json({ error: 'Failed to update ANSI art' });
  }
});

// Delete ANSI art (soft delete)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE ansi_art SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ANSI art not found' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete ANSI art error:', error);
    res.status(500).json({ error: 'Failed to delete ANSI art' });
  }
});

// Get categories
router.get('/categories/list', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM ansi_art_categories WHERE is_active = true ORDER BY display_order, name'
    );

    res.json(result.rows);

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Get HTML preview of ANSI art
router.get('/:id/preview', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT file_path, width, height FROM ansi_art WHERE id = $1 AND is_deleted = false',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ANSI art not found' });
    }

    const file = result.rows[0];
    const filePath = path.join(__dirname, '../uploads/ansi_art', file.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Convert ANSI to HTML
    const html = await ansiToHtml(filePath, {
      width: file.width || 80,
      fontFamily: '"Perfect DOS VGA 437", "DOS", Monaco, Menlo, Consolas, "Courier New", monospace'
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ANSI Art Preview</title>
        <style>
          body { margin: 0; padding: 0; background: #000; }
          @font-face {
            font-family: "Perfect DOS VGA 437";
            src: url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap");
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

module.exports = router;