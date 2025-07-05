const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');
const { gridToAnsi, generateMenuAnsi, ansiToHtml } = require('../utils/ansiUtils');

// ANSI color constants
const ANSI_COLORS = {
  BLACK: 0,
  RED: 1,
  GREEN: 2,
  YELLOW: 3,
  BLUE: 4,
  MAGENTA: 5,
  CYAN: 6,
  WHITE: 7,
  BRIGHT_BLACK: 8,
  BRIGHT_RED: 9,
  BRIGHT_GREEN: 10,
  BRIGHT_YELLOW: 11,
  BRIGHT_BLUE: 12,
  BRIGHT_MAGENTA: 13,
  BRIGHT_CYAN: 14,
  BRIGHT_WHITE: 15
};

// Box drawing characters
const BOX_CHARS = {
  SINGLE: {
    HORIZONTAL: '─',
    VERTICAL: '│',
    TOP_LEFT: '┌',
    TOP_RIGHT: '┐',
    BOTTOM_LEFT: '└',
    BOTTOM_RIGHT: '┘',
    CROSS: '┼',
    T_DOWN: '┬',
    T_UP: '┴',
    T_RIGHT: '├',
    T_LEFT: '┤'
  },
  DOUBLE: {
    HORIZONTAL: '═',
    VERTICAL: '║',
    TOP_LEFT: '╔',
    TOP_RIGHT: '╗',
    BOTTOM_LEFT: '╚',
    BOTTOM_RIGHT: '╝',
    CROSS: '╬',
    T_DOWN: '╦',
    T_UP: '╩',
    T_RIGHT: '╠',
    T_LEFT: '╣'
  }
};

// Get all menus
router.get('/', adminAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT m.*, u.username as created_by_username,
        COUNT(DISTINCT mi.id) as item_count
      FROM menus m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN menu_items mi ON m.id = mi.menu_id
      GROUP BY m.id, u.username
      ORDER BY m.created_at DESC
    `);

    res.json({
      success: true,
      menus: result.rows
    });
  } catch (error) {
    console.error('Error fetching menus:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menus' });
  }
});

// Get a specific menu with all its data
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const menuId = req.params.id;

    // Get menu details
    const menuResult = await db.query(`
      SELECT m.*, u.username as created_by_username
      FROM menus m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1
    `, [menuId]);

    if (menuResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }

    // Get menu items
    const itemsResult = await db.query(`
      SELECT * FROM menu_items
      WHERE menu_id = $1
      ORDER BY display_order, y_position, x_position
    `, [menuId]);

    // Get menu layout
    const layoutResult = await db.query(`
      SELECT * FROM menu_layouts
      WHERE menu_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [menuId]);

    res.json({
      success: true,
      menu: menuResult.rows[0],
      items: itemsResult.rows,
      layout: layoutResult.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menu' });
  }
});

// Create a new menu
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, description, width, height, background_color, foreground_color, is_main_menu } = req.body;
    const userId = req.user.id;

    const result = await db.query(`
      INSERT INTO menus (name, description, width, height, background_color, foreground_color, is_main_menu, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, description, width || 80, height || 25, background_color || 0, foreground_color || 7, is_main_menu || false, userId]);

    // Initialize empty layout
    const emptyGrid = Array(height || 25).fill(null).map(() => 
      Array(width || 80).fill({ char: ' ', fg: foreground_color || 7, bg: background_color || 0 })
    );

    await db.query(`
      INSERT INTO menu_layouts (menu_id, grid_data)
      VALUES ($1, $2)
    `, [result.rows[0].id, JSON.stringify(emptyGrid)]);

    res.json({
      success: true,
      menu: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating menu:', error);
    res.status(500).json({ success: false, error: 'Failed to create menu' });
  }
});

// Update menu
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const menuId = req.params.id;
    const { name, description, width, height, background_color, foreground_color, is_active, is_main_menu } = req.body;

    const result = await db.query(`
      UPDATE menus
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          width = COALESCE($3, width),
          height = COALESCE($4, height),
          background_color = COALESCE($5, background_color),
          foreground_color = COALESCE($6, foreground_color),
          is_active = COALESCE($7, is_active),
          is_main_menu = COALESCE($8, is_main_menu),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [name, description, width, height, background_color, foreground_color, is_active, is_main_menu, menuId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }

    res.json({
      success: true,
      menu: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ success: false, error: 'Failed to update menu' });
  }
});

// Delete menu
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const menuId = req.params.id;

    const result = await db.query('DELETE FROM menus WHERE id = $1 RETURNING id', [menuId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting menu:', error);
    res.status(500).json({ success: false, error: 'Failed to delete menu' });
  }
});

// Save menu layout
router.post('/:id/layout', adminAuth, async (req, res) => {
  try {
    const menuId = req.params.id;
    const { grid_data, box_elements, text_elements } = req.body;

    // Check if layout exists
    const existing = await db.query(
      'SELECT id FROM menu_layouts WHERE menu_id = $1',
      [menuId]
    );

    if (existing.rows.length > 0) {
      // Update existing layout
      await db.query(`
        UPDATE menu_layouts
        SET grid_data = $1,
            box_elements = $2,
            text_elements = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE menu_id = $4
      `, [JSON.stringify(grid_data), JSON.stringify(box_elements), JSON.stringify(text_elements), menuId]);
    } else {
      // Create new layout
      await db.query(`
        INSERT INTO menu_layouts (menu_id, grid_data, box_elements, text_elements)
        VALUES ($1, $2, $3, $4)
      `, [menuId, JSON.stringify(grid_data), JSON.stringify(box_elements), JSON.stringify(text_elements)]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving layout:', error);
    res.status(500).json({ success: false, error: 'Failed to save layout' });
  }
});

// Menu items CRUD operations
router.post('/:id/items', adminAuth, async (req, res) => {
  try {
    const menuId = req.params.id;
    const { hotkey, label, x_position, y_position, width, height, action_type, action_data,
            foreground_color, background_color, highlight_fg_color, highlight_bg_color,
            min_user_level, display_order } = req.body;

    const result = await db.query(`
      INSERT INTO menu_items (menu_id, hotkey, label, x_position, y_position, width, height,
                            action_type, action_data, foreground_color, background_color,
                            highlight_fg_color, highlight_bg_color, min_user_level, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [menuId, hotkey, label, x_position, y_position, width, height,
        action_type, JSON.stringify(action_data), foreground_color || 7, background_color || 0,
        highlight_fg_color || 0, highlight_bg_color || 7, min_user_level || 1, display_order || 0]);

    res.json({
      success: true,
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ success: false, error: 'Failed to create menu item' });
  }
});

router.put('/:menuId/items/:itemId', adminAuth, async (req, res) => {
  try {
    const { menuId, itemId } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'menu_id') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(key === 'action_data' ? JSON.stringify(updates[key]) : updates[key]);
        paramCount++;
      }
    });

    values.push(itemId, menuId);

    const result = await db.query(`
      UPDATE menu_items
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND menu_id = $${paramCount + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    res.json({
      success: true,
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ success: false, error: 'Failed to update menu item' });
  }
});

router.delete('/:menuId/items/:itemId', adminAuth, async (req, res) => {
  try {
    const { menuId, itemId } = req.params;

    const result = await db.query(
      'DELETE FROM menu_items WHERE id = $1 AND menu_id = $2 RETURNING id',
      [itemId, menuId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete menu item' });
  }
});

// Generate ANSI output
router.get('/:id/ansi', adminAuth, async (req, res) => {
  try {
    const menuId = req.params.id;

    // Get menu, layout and items
    const menuResult = await db.query('SELECT * FROM menus WHERE id = $1', [menuId]);
    if (menuResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }

    const layoutResult = await db.query(`
      SELECT * FROM menu_layouts
      WHERE menu_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [menuId]);

    const itemsResult = await db.query(
      'SELECT * FROM menu_items WHERE menu_id = $1 ORDER BY display_order',
      [menuId]
    );

    const menu = menuResult.rows[0];
    const layout = layoutResult.rows[0];
    const items = itemsResult.rows;

    // Generate ANSI sequence
    const ansiOutput = generateMenuAnsi(menu, layout, items);
    const htmlPreview = ansiToHtml(ansiOutput);

    res.json({
      success: true,
      ansi: ansiOutput,
      base64: Buffer.from(ansiOutput).toString('base64'),
      htmlPreview: htmlPreview
    });
  } catch (error) {
    console.error('Error generating ANSI:', error);
    res.status(500).json({ success: false, error: 'Failed to generate ANSI' });
  }
});

// Get menu templates
router.get('/templates/list', adminAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, category, preview_image, created_at
      FROM menu_templates
      WHERE is_public = true OR created_by = $1
      ORDER BY category, name
    `, [req.user.id]);

    res.json({
      success: true,
      templates: result.rows
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

// Save as template
router.post('/:id/save-template', adminAuth, async (req, res) => {
  try {
    const menuId = req.params.id;
    const { name, description, category } = req.body;

    // Get menu data
    const menuData = await db.query(`
      SELECT m.*, ml.grid_data, ml.box_elements, ml.text_elements
      FROM menus m
      LEFT JOIN menu_layouts ml ON m.id = ml.menu_id
      WHERE m.id = $1
    `, [menuId]);

    if (menuData.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }

    // Get menu items
    const items = await db.query(
      'SELECT * FROM menu_items WHERE menu_id = $1',
      [menuId]
    );

    const templateData = {
      menu: menuData.rows[0],
      items: items.rows
    };

    const result = await db.query(`
      INSERT INTO menu_templates (name, description, category, template_data, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [name, description, category, JSON.stringify(templateData), req.user.id]);

    res.json({
      success: true,
      templateId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ success: false, error: 'Failed to save template' });
  }
});

module.exports = router;