import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Terminal.css';

// ANSI color palette
const ANSI_COLORS = [
  '#000000', '#aa0000', '#00aa00', '#aa5500',
  '#0000aa', '#aa00aa', '#00aaaa', '#aaaaaa',
  '#555555', '#ff5555', '#55ff55', '#ffff55',
  '#5555ff', '#ff55ff', '#55ffff', '#ffffff'
];

export default function AnsiTerminal({ onInput, initialContent = '' }) {
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const [content, setContent] = useState(initialContent);
  const [inputBuffer, setInputBuffer] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [currentMenu, setCurrentMenu] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse ANSI codes and convert to HTML
  const parseAnsi = useCallback((text) => {
    // Handle special sequences
    text = text.replace(/\x1b\[2J\x1b\[H/g, ''); // Clear screen - handled separately
    text = text.replace(/\x1b\[\?25l/g, ''); // Hide cursor
    text = text.replace(/\x1b\[\?25h/g, ''); // Show cursor
    
    // Handle cursor positioning
    text = text.replace(/\x1b\[(\d+);(\d+)H/g, (match, row, col) => {
      // For now, we'll add newlines to simulate positioning
      return '\n'.repeat(parseInt(row) - 1);
    });

    // Parse color codes
    const ansiRegex = /\x1b\[([0-9;]+)m/g;
    let html = '';
    let lastIndex = 0;
    let currentFg = 7;
    let currentBg = 0;
    let isBold = false;
    let match;

    while ((match = ansiRegex.exec(text)) !== null) {
      // Add text before the ANSI code
      if (match.index > lastIndex) {
        const textSegment = text.substring(lastIndex, match.index);
        html += `<span style="color: ${ANSI_COLORS[currentFg]}; background-color: ${ANSI_COLORS[currentBg]}${isBold ? '; font-weight: bold' : ''}">${escapeHtml(textSegment)}</span>`;
      }

      // Parse ANSI codes
      const codes = match[1].split(';').map(Number);
      for (const code of codes) {
        if (code === 0) {
          // Reset
          currentFg = 7;
          currentBg = 0;
          isBold = false;
        } else if (code === 1) {
          // Bold
          isBold = true;
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

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const textSegment = text.substring(lastIndex);
      html += `<span style="color: ${ANSI_COLORS[currentFg]}; background-color: ${ANSI_COLORS[currentBg]}${isBold ? '; font-weight: bold' : ''}">${escapeHtml(textSegment)}</span>`;
    }

    return html;
  }, []);

  const escapeHtml = (text) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '\n': '<br>',
      ' ': '&nbsp;'
    };
    return text.replace(/[&<>"'\n ]/g, m => map[m]);
  };

  // Write text to terminal
  const write = useCallback((text) => {
    if (text.includes('\x1b[2J')) {
      // Clear screen
      setContent('');
      return;
    }
    
    setContent(prev => prev + text);
  }, []);

  // Load main menu on start
  useEffect(() => {
    const loadMainMenu = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          write('\x1b[31mPlease login first\x1b[0m\n');
          return;
        }

        const response = await fetch('/api/menu-display/active/main', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentMenu(data.menu);
          write(data.ansi);
        } else {
          write('\x1b[31mFailed to load menu\x1b[0m\n');
        }
      } catch (error) {
        console.error('Error loading menu:', error);
        write('\x1b[31mError loading menu\x1b[0m\n');
      }
    };

    loadMainMenu();
  }, [write]);

  // Handle input
  const handleKeyPress = async (e) => {
    if (isProcessing) return;

    if (e.key === 'Enter') {
      if (inputBuffer.trim() && currentMenu) {
        setIsProcessing(true);
        const input = inputBuffer.trim();
        setInputBuffer('');

        try {
          const response = await fetch('/api/menu-display/input', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              menuId: currentMenu.id,
              input: input
            })
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.ansi) {
              write('\n' + data.ansi + '\n');
            }

            // Handle different action types
            if (data.action === 'submenu' && data.nextMenu) {
              // Load submenu
              setTimeout(async () => {
                const menuResponse = await fetch(`/api/menu-display/${data.nextMenu}`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  }
                });

                if (menuResponse.ok) {
                  const menuData = await menuResponse.json();
                  setCurrentMenu(menuData.menu);
                  write(menuData.ansi);
                }
              }, 1000);
            } else if (data.action === 'command') {
              // Execute command
              if (onInput) {
                onInput(data.command);
              }
            }

            if (!data.success) {
              setTimeout(() => {
                write('Press any key to continue...');
              }, 1000);
            }
          }
        } catch (error) {
          console.error('Error processing input:', error);
          write('\x1b[31mError processing input\x1b[0m\n');
        } finally {
          setIsProcessing(false);
        }
      }
    } else if (e.key === 'Backspace') {
      setInputBuffer(prev => prev.slice(0, -1));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      setInputBuffer(prev => prev + e.key);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [content]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Focus input on click
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
      ref={terminalRef}
      className="ansi-terminal"
      onClick={handleTerminalClick}
      style={{
        backgroundColor: '#000000',
        color: '#aaaaaa',
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        fontSize: '14px',
        lineHeight: '1.2',
        padding: '10px',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        cursor: 'text',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: parseAnsi(content) }} />
      <span style={{ color: ANSI_COLORS[7] }}>
        {inputBuffer}
        <span style={{ 
          backgroundColor: cursorVisible ? ANSI_COLORS[7] : 'transparent',
          color: cursorVisible ? ANSI_COLORS[0] : ANSI_COLORS[7]
        }}>█</span>
      </span>
      <input
        ref={inputRef}
        type="text"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '0',
          height: '0',
          opacity: 0
        }}
        onKeyDown={handleKeyPress}
        autoFocus
      />
    </div>
  );
}