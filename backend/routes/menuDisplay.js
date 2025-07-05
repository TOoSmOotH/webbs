const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { generateMenuAnsi, generateMenuItem, moveCursor, setColor, reset, clearScreen } = require('../utils/ansiUtils');

// Get active menu for display (used by terminal)
router.get('/active/:menuType', authenticate, async (req, res) => {
  try {
    const menuType = req.params.menuType; // 'main', 'files', 'messages', etc.
    const userId = req.user.id;

    // Get user details for level checking
    const userResult = await db.query('SELECT user_level FROM users WHERE id = $1', [userId]);
    const userLevel = userResult.rows[0]?.user_level || 1;

    // Get the appropriate menu based on type
    let query = 'SELECT * FROM menus WHERE is_active = true';
    const params = [];

    if (menuType === 'main') {
      query += ' AND is_main_menu = true';
    } else {
      query += ' AND name = $1';
      params.push(menuType);
    }

    query += ' LIMIT 1';

    const menuResult = await db.query(query, params);
    if (menuResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }

    const menu = menuResult.rows[0];

    // Get menu layout
    const layoutResult = await db.query(`
      SELECT * FROM menu_layouts
      WHERE menu_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [menu.id]);

    // Get menu items accessible to user
    const itemsResult = await db.query(`
      SELECT * FROM menu_items
      WHERE menu_id = $1 AND is_visible = true AND min_user_level <= $2
      ORDER BY display_order, y_position, x_position
    `, [menu.id, userLevel]);

    const layout = layoutResult.rows[0];
    const items = itemsResult.rows;

    res.json({
      success: true,
      menu: menu,
      layout: layout,
      items: items,
      ansi: generateMenuAnsi(menu, layout, items)
    });
  } catch (error) {
    console.error('Error fetching active menu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menu' });
  }
});

// Handle menu input
router.post('/input', authenticate, async (req, res) => {
  try {
    const { menuId, input } = req.body;
    const userId = req.user.id;

    // Get user level
    const userResult = await db.query('SELECT user_level FROM users WHERE id = $1', [userId]);
    const userLevel = userResult.rows[0]?.user_level || 1;

    // Find the menu item by hotkey
    const itemResult = await db.query(`
      SELECT * FROM menu_items
      WHERE menu_id = $1 AND hotkey = $2 AND is_visible = true AND min_user_level <= $3
      LIMIT 1
    `, [menuId, input.toUpperCase(), userLevel]);

    if (itemResult.rows.length === 0) {
      return res.json({
        success: false,
        message: 'Invalid selection',
        ansi: `${setColor(9)}Invalid selection. Please try again.${reset()}`
      });
    }

    const item = itemResult.rows[0];

    // Process the action
    let response = {
      success: true,
      action: item.action_type,
      data: item.action_data
    };

    switch (item.action_type) {
      case 'submenu':
        // Load submenu
        response.nextMenu = item.action_data.menu_id;
        response.ansi = clearScreen() + 'Loading menu...';
        break;

      case 'command':
        // Execute internal command
        response.command = item.action_data.command;
        response.ansi = `${setColor(10)}Executing: ${item.label}${reset()}`;
        break;

      case 'script':
        // Run script (would need implementation)
        response.script = item.action_data.script_path;
        response.ansi = `${setColor(11)}Running script: ${item.label}${reset()}`;
        break;

      case 'external':
        // Launch external program (would need implementation)
        response.external = item.action_data.program;
        response.ansi = `${setColor(12)}Launching: ${item.label}${reset()}`;
        break;

      default:
        response.ansi = `${setColor(9)}Unknown action type${reset()}`;
    }

    // Log activity
    await db.query(`
      INSERT INTO user_activity (user_id, activity_type, activity_data)
      VALUES ($1, 'menu_selection', $2)
    `, [userId, JSON.stringify({ menu_id: menuId, item_id: item.id, label: item.label })]);

    res.json(response);
  } catch (error) {
    console.error('Error handling menu input:', error);
    res.status(500).json({ success: false, error: 'Failed to process input' });
  }
});

// Get menu by ID (for navigation)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const menuId = req.params.id;
    const userId = req.user.id;

    // Get user level
    const userResult = await db.query('SELECT user_level FROM users WHERE id = $1', [userId]);
    const userLevel = userResult.rows[0]?.user_level || 1;

    // Get menu
    const menuResult = await db.query('SELECT * FROM menus WHERE id = $1 AND is_active = true', [menuId]);
    if (menuResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }

    const menu = menuResult.rows[0];

    // Get layout
    const layoutResult = await db.query(`
      SELECT * FROM menu_layouts
      WHERE menu_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [menuId]);

    // Get accessible items
    const itemsResult = await db.query(`
      SELECT * FROM menu_items
      WHERE menu_id = $1 AND is_visible = true AND min_user_level <= $2
      ORDER BY display_order, y_position, x_position
    `, [menuId, userLevel]);

    const layout = layoutResult.rows[0];
    const items = itemsResult.rows;

    res.json({
      success: true,
      menu: menu,
      layout: layout,
      items: items,
      ansi: generateMenuAnsi(menu, layout, items)
    });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menu' });
  }
});

module.exports = router;