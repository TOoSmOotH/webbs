const fs = require('fs').promises;

// ANSI color codes to CSS colors
const ansiColors = {
  // Normal colors
  0: '#000000', // Black
  1: '#aa0000', // Red
  2: '#00aa00', // Green
  3: '#aa5500', // Brown/Yellow
  4: '#0000aa', // Blue
  5: '#aa00aa', // Magenta
  6: '#00aaaa', // Cyan
  7: '#aaaaaa', // Light Gray
  // Bright colors
  8: '#555555',  // Dark Gray
  9: '#ff5555',  // Light Red
  10: '#55ff55', // Light Green
  11: '#ffff55', // Yellow
  12: '#5555ff', // Light Blue
  13: '#ff55ff', // Light Magenta
  14: '#55ffff', // Light Cyan
  15: '#ffffff'  // White
};

// CP437 character mapping for special characters
const cp437Map = {
  0x00: ' ', 0x01: '☺', 0x02: '☻', 0x03: '♥', 0x04: '♦', 0x05: '♣', 0x06: '♠', 0x07: '•',
  0x08: '◘', 0x09: '○', 0x0A: '\n', 0x0B: '♂', 0x0C: '♀', 0x0D: '\r', 0x0E: '♫', 0x0F: '☼',
  0x10: '►', 0x11: '◄', 0x12: '↕', 0x13: '‼', 0x14: '¶', 0x15: '§', 0x16: '▬', 0x17: '↨',
  0x18: '↑', 0x19: '↓', 0x1A: '→', 0x1B: '←', 0x1C: '∟', 0x1D: '↔', 0x1E: '▲', 0x1F: '▼',
  0x7F: '⌂',
  0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à', 0x86: 'å', 0x87: 'ç',
  0x88: 'ê', 0x89: 'ë', 0x8A: 'è', 0x8B: 'ï', 0x8C: 'î', 0x8D: 'ì', 0x8E: 'Ä', 0x8F: 'Å',
  0x90: 'É', 0x91: 'æ', 0x92: 'Æ', 0x93: 'ô', 0x94: 'ö', 0x95: 'ò', 0x96: 'û', 0x97: 'ù',
  0x98: 'ÿ', 0x99: 'Ö', 0x9A: 'Ü', 0x9B: '¢', 0x9C: '£', 0x9D: '¥', 0x9E: '₧', 0x9F: 'ƒ',
  0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ñ', 0xA5: 'Ñ', 0xA6: 'ª', 0xA7: 'º',
  0xA8: '¿', 0xA9: '⌐', 0xAA: '¬', 0xAB: '½', 0xAC: '¼', 0xAD: '¡', 0xAE: '«', 0xAF: '»',
  0xB0: '░', 0xB1: '▒', 0xB2: '▓', 0xB3: '│', 0xB4: '┤', 0xB5: '╡', 0xB6: '╢', 0xB7: '╖',
  0xB8: '╕', 0xB9: '╣', 0xBA: '║', 0xBB: '╗', 0xBC: '╝', 0xBD: '╜', 0xBE: '╛', 0xBF: '┐',
  0xC0: '└', 0xC1: '┴', 0xC2: '┬', 0xC3: '├', 0xC4: '─', 0xC5: '┼', 0xC6: '╞', 0xC7: '╟',
  0xC8: '╚', 0xC9: '╔', 0xCA: '╩', 0xCB: '╦', 0xCC: '╠', 0xCD: '═', 0xCE: '╬', 0xCF: '╧',
  0xD0: '╨', 0xD1: '╤', 0xD2: '╥', 0xD3: '╙', 0xD4: '╘', 0xD5: '╒', 0xD6: '╓', 0xD7: '╫',
  0xD8: '╪', 0xD9: '┘', 0xDA: '┌', 0xDB: '█', 0xDC: '▄', 0xDD: '▌', 0xDE: '▐', 0xDF: '▀',
  0xE0: 'α', 0xE1: 'ß', 0xE2: 'Γ', 0xE3: 'π', 0xE4: 'Σ', 0xE5: 'σ', 0xE6: 'µ', 0xE7: 'τ',
  0xE8: 'Φ', 0xE9: 'Θ', 0xEA: 'Ω', 0xEB: 'δ', 0xEC: '∞', 0xED: 'φ', 0xEE: 'ε', 0xEF: '∩',
  0xF0: '≡', 0xF1: '±', 0xF2: '≥', 0xF3: '≤', 0xF4: '⌠', 0xF5: '⌡', 0xF6: '÷', 0xF7: '≈',
  0xF8: '°', 0xF9: '∙', 0xFA: '·', 0xFB: '√', 0xFC: 'ⁿ', 0xFD: '²', 0xFE: '■', 0xFF: ' '
};

// Convert CP437 byte to Unicode character
function cp437ToUnicode(byte) {
  if (byte >= 0x20 && byte < 0x7F) {
    return String.fromCharCode(byte);
  }
  return cp437Map[byte] || String.fromCharCode(byte);
}

// Parse ANSI escape sequences and convert to HTML
async function ansiToHtml(filePath, options = {}) {
  const {
    width = 80,
    fontFamily = 'DOS, Monaco, Menlo, Consolas, "Courier New", monospace',
    fontSize = '16px',
    lineHeight = '1.0',
    backgroundColor = '#000000',
    defaultForeground = 7,
    defaultBackground = 0
  } = options;

  try {
    // Read file as buffer to handle binary data
    const buffer = await fs.readFile(filePath);
    
    let html = [];
    let currentFg = defaultForeground;
    let currentBg = defaultBackground;
    let bold = false;
    let blink = false;
    let currentLine = [];
    let column = 0;
    
    // Process each byte
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      
      // Check for ANSI escape sequence
      if (byte === 0x1B && i + 1 < buffer.length && buffer[i + 1] === 0x5B) { // ESC[
        i += 2; // Skip ESC[
        
        // Parse ANSI codes
        let codes = [];
        let currentCode = '';
        
        while (i < buffer.length) {
          const char = buffer[i];
          if (char >= 0x30 && char <= 0x39) { // 0-9
            currentCode += String.fromCharCode(char);
          } else if (char === 0x3B) { // ;
            codes.push(parseInt(currentCode) || 0);
            currentCode = '';
          } else if (char === 0x6D) { // m
            codes.push(parseInt(currentCode) || 0);
            break;
          } else if (char === 0x48) { // H - cursor position
            // For now, ignore cursor positioning
            break;
          } else if (char === 0x4A) { // J - clear screen
            // For now, ignore clear screen
            break;
          } else if (char === 0x4B) { // K - clear line
            // For now, ignore clear line
            break;
          } else {
            break;
          }
          i++;
        }
        
        // Process SGR codes
        for (const code of codes) {
          if (code === 0) { // Reset
            currentFg = defaultForeground;
            currentBg = defaultBackground;
            bold = false;
            blink = false;
          } else if (code === 1) { // Bold/bright
            bold = true;
          } else if (code === 5) { // Blink
            blink = true;
          } else if (code === 22) { // Normal intensity
            bold = false;
          } else if (code === 25) { // Blink off
            blink = false;
          } else if (code >= 30 && code <= 37) { // Foreground color
            currentFg = code - 30;
          } else if (code >= 40 && code <= 47) { // Background color
            currentBg = code - 40;
          } else if (code >= 90 && code <= 97) { // Bright foreground
            currentFg = code - 90 + 8;
          } else if (code >= 100 && code <= 107) { // Bright background
            currentBg = code - 100 + 8;
          }
        }
      } else if (byte === 0x0A) { // Line feed
        // End current line
        if (currentLine.length > 0 || column > 0) {
          html.push(currentLine.join(''));
          html.push('<br>');
          currentLine = [];
          column = 0;
        }
      } else if (byte === 0x0D) { // Carriage return
        // Ignore for now
      } else {
        // Regular character
        const char = cp437ToUnicode(byte);
        
        // Apply colors
        let style = [];
        const fg = bold && currentFg < 8 ? currentFg + 8 : currentFg;
        style.push(`color:${ansiColors[fg]}`);
        if (currentBg !== defaultBackground) {
          style.push(`background-color:${ansiColors[currentBg]}`);
        }
        if (blink) {
          style.push('animation:blink 1s infinite');
        }
        
        if (style.length > 0) {
          currentLine.push(`<span style="${style.join(';')}">${escapeHtml(char)}</span>`);
        } else {
          currentLine.push(escapeHtml(char));
        }
        
        column++;
        
        // Auto-wrap at width
        if (column >= width) {
          html.push(currentLine.join(''));
          html.push('<br>');
          currentLine = [];
          column = 0;
        }
      }
    }
    
    // Add any remaining content
    if (currentLine.length > 0) {
      html.push(currentLine.join(''));
    }
    
    // Wrap in container
    const containerStyle = [
      `font-family:${fontFamily}`,
      `font-size:${fontSize}`,
      `line-height:${lineHeight}`,
      `background-color:${backgroundColor}`,
      `color:${ansiColors[defaultForeground]}`,
      'white-space:pre',
      'overflow-x:auto',
      'padding:10px'
    ].join(';');
    
    const blinkKeyframes = `
      @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
    `;
    
    return `
      <style>${blinkKeyframes}</style>
      <div style="${containerStyle}">
        ${html.join('')}
      </div>
    `;
    
  } catch (error) {
    console.error('Error converting ANSI to HTML:', error);
    throw error;
  }
}

// Escape HTML special characters
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Generate a preview image URL for an ANSI file
async function generatePreview(ansiId) {
  // This would integrate with an ANSI rendering service
  // For now, return a placeholder
  return `/api/ansi-art/${ansiId}/preview`;
}

module.exports = {
  ansiToHtml,
  generatePreview,
  cp437ToUnicode
};