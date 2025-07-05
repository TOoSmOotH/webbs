// ANSI escape sequences and utilities for menu generation

// ANSI color codes
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

// ANSI escape codes
const ESC = '\x1b';
const CSI = `${ESC}[`;

// Generate ANSI color escape sequences
function setColor(fg, bg = null) {
  let code = '';
  
  if (fg !== null && fg !== undefined) {
    if (fg < 8) {
      code += `${CSI}${30 + fg}m`;
    } else {
      code += `${CSI}${90 + (fg - 8)}m`;
    }
  }
  
  if (bg !== null && bg !== undefined) {
    if (bg < 8) {
      code += `${CSI}${40 + bg}m`;
    } else {
      code += `${CSI}${100 + (bg - 8)}m`;
    }
  }
  
  return code;
}

// Reset all attributes
function reset() {
  return `${CSI}0m`;
}

// Clear screen
function clearScreen() {
  return `${CSI}2J${CSI}H`;
}

// Move cursor to position (1-based)
function moveCursor(x, y) {
  return `${CSI}${y};${x}H`;
}

// Hide/show cursor
function hideCursor() {
  return `${CSI}?25l`;
}

function showCursor() {
  return `${CSI}?25h`;
}

// Convert grid data to ANSI sequence
function gridToAnsi(gridData, width = 80, height = 25) {
  let output = clearScreen();
  let lastFg = null;
  let lastBg = null;
  
  for (let y = 0; y < height && y < gridData.length; y++) {
    output += moveCursor(1, y + 1);
    
    for (let x = 0; x < width && x < gridData[y].length; x++) {
      const cell = gridData[y][x];
      
      if (!cell) {
        output += ' ';
        continue;
      }
      
      // Only output color codes if they've changed
      if (cell.fg !== lastFg || cell.bg !== lastBg) {
        output += setColor(cell.fg, cell.bg);
        lastFg = cell.fg;
        lastBg = cell.bg;
      }
      
      output += cell.char || ' ';
    }
  }
  
  output += reset();
  return output;
}

// Generate ANSI for a menu with items
function generateMenuAnsi(menu, layout, items) {
  let output = '';
  
  // Start with the grid layout
  if (layout && layout.grid_data) {
    output += gridToAnsi(layout.grid_data, menu.width, menu.height);
  }
  
  // Add interactive elements for menu items
  output += hideCursor();
  
  // Position cursor at bottom for input
  output += moveCursor(1, menu.height);
  output += setColor(7, 0); // White on black
  output += 'Select option: ';
  output += showCursor();
  
  return output;
}

// Convert ANSI sequence to HTML (for preview)
function ansiToHtml(ansiText) {
  const ansiRegex = /\x1b\[([0-9;]+)m/g;
  let html = '<pre style="background: black; color: #aaa; font-family: monospace; padding: 10px;">';
  let currentFg = 7;
  let currentBg = 0;
  let position = 0;
  
  // Color map for HTML
  const colorMap = [
    '#000000', '#aa0000', '#00aa00', '#aa5500',
    '#0000aa', '#aa00aa', '#00aaaa', '#aaaaaa',
    '#555555', '#ff5555', '#55ff55', '#ffff55',
    '#5555ff', '#ff55ff', '#55ffff', '#ffffff'
  ];
  
  ansiText = ansiText.replace(/\x1b\[2J\x1b\[H/g, ''); // Remove clear screen
  ansiText = ansiText.replace(/\x1b\[\d+;\d+H/g, ''); // Remove cursor positioning for now
  ansiText = ansiText.replace(/\x1b\[\?25[lh]/g, ''); // Remove cursor hide/show
  
  let match;
  while ((match = ansiRegex.exec(ansiText)) !== null) {
    // Add text before the match
    if (match.index > position) {
      const text = ansiText.substring(position, match.index);
      html += escapeHtml(text);
    }
    
    // Parse ANSI codes
    const codes = match[1].split(';').map(Number);
    for (const code of codes) {
      if (code === 0) {
        // Reset
        currentFg = 7;
        currentBg = 0;
        html += '</span>';
      } else if (code >= 30 && code <= 37) {
        // Foreground color
        currentFg = code - 30;
      } else if (code >= 90 && code <= 97) {
        // Bright foreground color
        currentFg = code - 90 + 8;
      } else if (code >= 40 && code <= 47) {
        // Background color
        currentBg = code - 40;
      } else if (code >= 100 && code <= 107) {
        // Bright background color
        currentBg = code - 100 + 8;
      }
    }
    
    // Apply new colors
    html += `<span style="color: ${colorMap[currentFg]}; background-color: ${colorMap[currentBg]};">`;
    
    position = match.index + match[0].length;
  }
  
  // Add remaining text
  if (position < ansiText.length) {
    html += escapeHtml(ansiText.substring(position));
  }
  
  html += '</span></pre>';
  return html;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Generate menu item with highlighting
function generateMenuItem(item, isHighlighted = false) {
  let output = moveCursor(item.x_position + 1, item.y_position + 1);
  
  if (isHighlighted) {
    output += setColor(item.highlight_fg_color, item.highlight_bg_color);
  } else {
    output += setColor(item.foreground_color, item.background_color);
  }
  
  output += `[${item.hotkey}] ${item.label}`;
  output += reset();
  
  return output;
}

// Export functions
module.exports = {
  ANSI_COLORS,
  setColor,
  reset,
  clearScreen,
  moveCursor,
  hideCursor,
  showCursor,
  gridToAnsi,
  generateMenuAnsi,
  ansiToHtml,
  generateMenuItem
};