const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const db = require('../config/database');

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Use temp directory initially, move to proper location after validation
    const tempDir = path.join(__dirname, '../uploads/temp');
    await fs.mkdir(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  // Reject dangerous file types
  const dangerousTypes = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (dangerousTypes.includes(ext) && !req.body.allowExecutable) {
    return cb(new Error('Executable files require special permission'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB default limit
    files: 1
  },
  fileFilter: fileFilter
});

// Helper function to calculate file checksum
const calculateChecksum = async (filePath) => {
  const hash = crypto.createHash('sha256');
  const stream = require('fs').createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

// Upload file endpoint - supports HTTPS through Express/Node configuration
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { file } = req;
    const { 
      area_id = 1, 
      board_id = null, 
      description = '', 
      is_public = true 
    } = req.body;

    // Validate file area
    const areaResult = await db.query(
      'SELECT * FROM file_areas WHERE id = $1 AND is_active = true',
      [area_id]
    );

    if (areaResult.rows.length === 0) {
      await fs.unlink(file.path);
      return res.status(400).json({ error: 'Invalid file area' });
    }

    const fileArea = areaResult.rows[0];

    // Check file extension against allowed list
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (fileArea.allowed_extensions && 
        fileArea.allowed_extensions.length > 0 && 
        !fileArea.allowed_extensions.includes(ext)) {
      await fs.unlink(file.path);
      return res.status(400).json({ 
        error: `File type .${ext} not allowed in ${fileArea.name}` 
      });
    }

    // Check file size limit
    if (file.size > fileArea.max_file_size) {
      await fs.unlink(file.path);
      return res.status(400).json({ 
        error: `File size exceeds limit of ${fileArea.max_file_size / (1024*1024)}MB` 
      });
    }

    // Calculate checksum
    const checksum = await calculateChecksum(file.path);

    // Move file to proper directory
    const areaDir = fileArea.name.toLowerCase().replace(/\s+/g, '_');
    const finalDir = path.join(__dirname, '../uploads', areaDir);
    await fs.mkdir(finalDir, { recursive: true });
    
    const finalPath = path.join(finalDir, file.filename);
    await fs.rename(file.path, finalPath);

    // Store file metadata in database
    const result = await db.query(
      `INSERT INTO files (
        filename, original_filename, file_path, file_size, mime_type,
        description, uploaded_by, board_id, file_area_id, is_public,
        checksum, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        file.filename,
        file.originalname,
        path.relative(path.join(__dirname, '../uploads'), finalPath),
        file.size,
        file.mimetype,
        description,
        req.user?.id || null,
        board_id,
        area_id,
        is_public,
        checksum,
        JSON.stringify({
          uploadedAt: new Date(),
          userAgent: req.headers['user-agent'],
          ip: req.ip
        })
      ]
    );

    res.json({
      success: true,
      file: {
        id: result.rows[0].id,
        filename: result.rows[0].original_filename,
        size: result.rows[0].file_size,
        checksum: result.rows[0].checksum,
        downloadUrl: `/api/files/download/${result.rows[0].id}`
      }
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

// Download file endpoint - serves files over HTTPS
router.get('/download/:id', async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    
    // Get file metadata
    const result = await db.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Check access permissions
    if (!file.is_public && (!req.user || req.user.id !== file.uploaded_by)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Construct full file path
    const filePath = path.join(__dirname, '../uploads', file.file_path);

    // Check if file exists on disk
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Update download count and last downloaded timestamp
    await db.query(
      'UPDATE files SET download_count = download_count + 1, last_downloaded = CURRENT_TIMESTAMP WHERE id = $1',
      [fileId]
    );

    // Set secure headers for file download
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Length', file.file_size);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Stream file to response
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// List files endpoint
router.get('/list', async (req, res) => {
  try {
    const { 
      area_id, 
      board_id, 
      limit = 50, 
      offset = 0,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    let query = `
      SELECT f.*, fa.name as area_name, u.username as uploader_name
      FROM files f
      LEFT JOIN file_areas fa ON f.file_area_id = fa.id
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.is_deleted = false
    `;
    const params = [];
    let paramCount = 0;

    if (area_id) {
      params.push(area_id);
      query += ` AND f.file_area_id = $${++paramCount}`;
    }

    if (board_id) {
      params.push(board_id);
      query += ` AND f.board_id = $${++paramCount}`;
    }

    // Only show public files or user's own files
    if (!req.user) {
      query += ' AND f.is_public = true';
    } else {
      params.push(req.user.id);
      query += ` AND (f.is_public = true OR f.uploaded_by = $${++paramCount})`;
    }

    // Add sorting
    const allowedSorts = ['created_at', 'file_size', 'download_count', 'filename'];
    const sortField = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY f.${sortField} ${sortOrder}`;

    // Add pagination
    params.push(limit);
    query += ` LIMIT $${++paramCount}`;
    params.push(offset);
    query += ` OFFSET $${++paramCount}`;

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM files f
      WHERE f.is_deleted = false
    `;
    const countParams = [];
    paramCount = 0;

    if (area_id) {
      countParams.push(area_id);
      countQuery += ` AND f.file_area_id = $${++paramCount}`;
    }

    if (board_id) {
      countParams.push(board_id);
      countQuery += ` AND f.board_id = $${++paramCount}`;
    }

    if (!req.user) {
      countQuery += ' AND f.is_public = true';
    } else {
      countParams.push(req.user.id);
      countQuery += ` AND (f.is_public = true OR f.uploaded_by = $${++paramCount})`;
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      files: result.rows.map(file => ({
        id: file.id,
        filename: file.original_filename,
        size: file.file_size,
        area: file.area_name,
        uploader: file.uploader_name,
        description: file.description,
        downloads: file.download_count,
        uploaded: file.created_at,
        downloadUrl: `/api/files/download/${file.id}`
      })),
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < totalCount
      }
    });

  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Get file areas
router.get('/areas', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM file_areas WHERE is_active = true ORDER BY name'
    );

    res.json({
      areas: result.rows.map(area => ({
        id: area.id,
        name: area.name,
        description: area.description,
        maxFileSize: area.max_file_size,
        allowedExtensions: area.allowed_extensions
      }))
    });

  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Failed to get file areas' });
  }
});

// Delete file (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    
    // Check if user owns the file or is admin
    const fileResult = await db.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    if (!req.user || (req.user.id !== file.uploaded_by && req.user.user_level < 5)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Soft delete the file
    await db.query(
      'UPDATE files SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [fileId]
    );

    res.json({ success: true, message: 'File deleted successfully' });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;