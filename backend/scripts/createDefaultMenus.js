const db = require('../config/database');
const { clearScreen, setColor, reset, moveCursor } = require('../utils/ansiUtils');

async function createDefaultMenus() {
  try {
    console.log('Creating default menus...');

    // Create main menu
    const mainMenuResult = await db.query(`
      INSERT INTO menus (name, description, width, height, background_color, foreground_color, is_main_menu, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (name) DO UPDATE SET is_main_menu = true, is_active = true
      RETURNING id
    `, [
      'Main Menu',
      'WebBBS Main Menu',
      80,
      25,
      0,  // Black background
      7,  // White foreground
      true,
      true
    ]);

    const mainMenuId = mainMenuResult.rows[0].id;

    // Create main menu layout
    const mainGrid = Array(25).fill(null).map(() => 
      Array(80).fill({ char: ' ', fg: 7, bg: 0 })
    );

    // Add header
    const header = '═══════════════════════ WebBBS Main Menu ═══════════════════════';
    for (let i = 0; i < header.length; i++) {
      if (i + 7 < 80) {
        mainGrid[2][i + 7] = { char: header[i], fg: 14, bg: 0 }; // Bright cyan
      }
    }

    // Add box around menu area
    const boxChars = {
      topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝',
      horizontal: '═', vertical: '║'
    };

    // Draw box (20 cols from left, 5 rows from top, 40 wide, 15 tall)
    const boxX = 20, boxY = 5, boxW = 40, boxH = 15;
    
    // Top border
    mainGrid[boxY][boxX] = { char: boxChars.topLeft, fg: 7, bg: 0 };
    mainGrid[boxY][boxX + boxW - 1] = { char: boxChars.topRight, fg: 7, bg: 0 };
    for (let x = boxX + 1; x < boxX + boxW - 1; x++) {
      mainGrid[boxY][x] = { char: boxChars.horizontal, fg: 7, bg: 0 };
    }

    // Bottom border
    mainGrid[boxY + boxH - 1][boxX] = { char: boxChars.bottomLeft, fg: 7, bg: 0 };
    mainGrid[boxY + boxH - 1][boxX + boxW - 1] = { char: boxChars.bottomRight, fg: 7, bg: 0 };
    for (let x = boxX + 1; x < boxX + boxW - 1; x++) {
      mainGrid[boxY + boxH - 1][x] = { char: boxChars.horizontal, fg: 7, bg: 0 };
    }

    // Side borders
    for (let y = boxY + 1; y < boxY + boxH - 1; y++) {
      mainGrid[y][boxX] = { char: boxChars.vertical, fg: 7, bg: 0 };
      mainGrid[y][boxX + boxW - 1] = { char: boxChars.vertical, fg: 7, bg: 0 };
    }

    // Save layout
    await db.query(`
      INSERT INTO menu_layouts (menu_id, grid_data)
      VALUES ($1, $2)
      ON CONFLICT ON CONSTRAINT menu_layouts_menu_id_key DO UPDATE SET grid_data = $2
    `, [mainMenuId, JSON.stringify(mainGrid)]);

    // Create menu items
    const menuItems = [
      { hotkey: 'M', label: 'Messages', x: 24, y: 7, action: 'command', data: { command: 'messages' } },
      { hotkey: 'F', label: 'Files', x: 24, y: 9, action: 'command', data: { command: 'files' } },
      { hotkey: 'U', label: 'User List', x: 24, y: 11, action: 'command', data: { command: 'users' } },
      { hotkey: 'C', label: 'Chat', x: 24, y: 13, action: 'command', data: { command: 'chat' } },
      { hotkey: 'S', label: 'Settings', x: 24, y: 15, action: 'submenu', data: { menu_id: null } }, // Will update
      { hotkey: 'L', label: 'Logout', x: 24, y: 17, action: 'command', data: { command: 'logout' } }
    ];

    for (const item of menuItems) {
      // Draw menu item in grid
      const itemText = `[${item.hotkey}] ${item.label}`;
      for (let i = 0; i < itemText.length; i++) {
        if (item.x + i < 80 && item.y < 25) {
          mainGrid[item.y][item.x + i] = { 
            char: itemText[i], 
            fg: i === 1 ? 11 : 7, // Highlight hotkey in yellow
            bg: 0 
          };
        }
      }

      // Insert menu item
      await db.query(`
        INSERT INTO menu_items (
          menu_id, hotkey, label, x_position, y_position, 
          action_type, action_data, foreground_color, background_color,
          highlight_fg_color, highlight_bg_color, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (menu_id, hotkey) DO UPDATE SET
          label = $3, x_position = $4, y_position = $5, action_type = $6, action_data = $7
      `, [
        mainMenuId, item.hotkey, item.label, item.x, item.y,
        item.action, JSON.stringify(item.data), 7, 0, 0, 7,
        menuItems.indexOf(item)
      ]);
    }

    // Update grid with final layout
    await db.query(`
      UPDATE menu_layouts SET grid_data = $1 WHERE menu_id = $2
    `, [JSON.stringify(mainGrid), mainMenuId]);

    // Create Settings submenu
    const settingsMenuResult = await db.query(`
      INSERT INTO menus (name, description, width, height, background_color, foreground_color, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (name) DO UPDATE SET is_active = true
      RETURNING id
    `, [
      'Settings Menu',
      'User Settings',
      80,
      25,
      0,
      7,
      true
    ]);

    const settingsMenuId = settingsMenuResult.rows[0].id;

    // Update main menu settings item to point to settings menu
    await db.query(`
      UPDATE menu_items 
      SET action_data = $1 
      WHERE menu_id = $2 AND hotkey = 'S'
    `, [JSON.stringify({ menu_id: settingsMenuId }), mainMenuId]);

    // Create settings menu layout
    const settingsGrid = Array(25).fill(null).map(() => 
      Array(80).fill({ char: ' ', fg: 7, bg: 0 })
    );

    // Add header
    const settingsHeader = '═══════════════════════ User Settings ═══════════════════════';
    for (let i = 0; i < settingsHeader.length; i++) {
      if (i + 9 < 80) {
        settingsGrid[2][i + 9] = { char: settingsHeader[i], fg: 10, bg: 0 }; // Bright green
      }
    }

    // Save settings layout
    await db.query(`
      INSERT INTO menu_layouts (menu_id, grid_data)
      VALUES ($1, $2)
      ON CONFLICT ON CONSTRAINT menu_layouts_menu_id_key DO UPDATE SET grid_data = $2
    `, [settingsMenuId, JSON.stringify(settingsGrid)]);

    // Create settings menu items
    const settingsItems = [
      { hotkey: 'P', label: 'Profile', x: 24, y: 7, action: 'command', data: { command: 'profile' } },
      { hotkey: 'T', label: 'Terminal Settings', x: 24, y: 9, action: 'command', data: { command: 'terminal_settings' } },
      { hotkey: 'N', label: 'Notifications', x: 24, y: 11, action: 'command', data: { command: 'notifications' } },
      { hotkey: 'M', label: 'Main Menu', x: 24, y: 15, action: 'submenu', data: { menu_id: mainMenuId } }
    ];

    for (const item of settingsItems) {
      // Draw menu item in grid
      const itemText = `[${item.hotkey}] ${item.label}`;
      for (let i = 0; i < itemText.length; i++) {
        if (item.x + i < 80 && item.y < 25) {
          settingsGrid[item.y][item.x + i] = { 
            char: itemText[i], 
            fg: i === 1 ? 11 : 7, // Highlight hotkey
            bg: 0 
          };
        }
      }

      await db.query(`
        INSERT INTO menu_items (
          menu_id, hotkey, label, x_position, y_position, 
          action_type, action_data, foreground_color, background_color,
          highlight_fg_color, highlight_bg_color, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (menu_id, hotkey) DO NOTHING
      `, [
        settingsMenuId, item.hotkey, item.label, item.x, item.y,
        item.action, JSON.stringify(item.data), 7, 0, 0, 7,
        settingsItems.indexOf(item)
      ]);
    }

    // Update settings grid
    await db.query(`
      UPDATE menu_layouts SET grid_data = $1 WHERE menu_id = $2
    `, [JSON.stringify(settingsGrid), settingsMenuId]);

    // Create menu templates
    const templates = [
      {
        name: 'Classic BBS Menu',
        description: 'Traditional BBS-style menu with box borders',
        category: 'classic',
        data: {
          width: 80,
          height: 25,
          style: 'box',
          colors: { fg: 7, bg: 0, highlight: 14 }
        }
      },
      {
        name: 'Modern List Menu',
        description: 'Clean list-style menu without borders',
        category: 'modern',
        data: {
          width: 80,
          height: 25,
          style: 'list',
          colors: { fg: 15, bg: 0, highlight: 10 }
        }
      },
      {
        name: 'Compact Menu',
        description: 'Space-efficient menu for limited screen space',
        category: 'compact',
        data: {
          width: 80,
          height: 25,
          style: 'compact',
          colors: { fg: 7, bg: 0, highlight: 11 }
        }
      }
    ];

    for (const template of templates) {
      await db.query(`
        INSERT INTO menu_templates (name, description, category, template_data, is_public)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO NOTHING
      `, [template.name, template.description, template.category, JSON.stringify(template.data), true]);
    }

    console.log('Default menus created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating default menus:', error);
    process.exit(1);
  }
}

createDefaultMenus();