import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import io from 'socket.io-client';
import axios from 'axios';
import 'xterm/css/xterm.css';
import './Terminal.css';

const Terminal = () => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const socketRef = useRef(null);
  const [currentCommand, setCurrentCommand] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPrompt, setCurrentPrompt] = useState('BBS> ');

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new XTerm({
      rows: 25,
      cols: 80,
      theme: {
        background: '#000000',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#000000',
        selection: '#ffffff40',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#55ff55',
        brightYellow: '#ffff55',
        brightBlue: '#5555ff',
        brightMagenta: '#ff55ff',
        brightCyan: '#55ffff',
        brightWhite: '#ffffff'
      },
      fontFamily: 'Courier New, monospace',
      fontSize: 14,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      allowTransparency: true,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
      convertEol: true
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Open terminal
    term.open(terminalRef.current);
    
    // Store references
    xtermRef.current = term;
    
    // Fit terminal after a short delay to ensure DOM is ready
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (error) {
        console.warn('Initial fit failed, retrying...', error);
        // Retry after another delay
        setTimeout(() => {
          try {
            fitAddon.fit();
          } catch (e) {
            console.error('Failed to fit terminal:', e);
          }
        }, 100);
      }
    }, 10);

    // Initialize socket connection
    socketRef.current = io('http://localhost:5000');

    // Socket event handlers
    socketRef.current.on('connect', () => {
      console.log('Connected to backend');
      loadWelcomeMessage();
    });

    socketRef.current.on('terminal-output', (data) => {
      term.write(data.text + '\r\n');
      showPrompt();
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from backend');
    });

    // Handle user input
    let inputBuffer = '';
    let tempHistoryIndex = -1;
    let escapeSequence = '';
    
    term.onData((data) => {
      // Handle escape sequences
      if (escapeSequence) {
        escapeSequence += data;
        
        if (escapeSequence === '\x1b[A') { // Up arrow
          escapeSequence = '';
          if (commandHistory.length > 0) {
            if (tempHistoryIndex < commandHistory.length - 1) {
              tempHistoryIndex++;
              const historicalCommand = commandHistory[tempHistoryIndex];
              
              // Clear current input
              for (let i = 0; i < inputBuffer.length; i++) {
                term.write('\b \b');
              }
              
              // Write historical command
              inputBuffer = historicalCommand;
              term.write(historicalCommand);
            }
          }
          return;
        } else if (escapeSequence === '\x1b[B') { // Down arrow
          escapeSequence = '';
          if (tempHistoryIndex > 0) {
            tempHistoryIndex--;
            const historicalCommand = commandHistory[tempHistoryIndex];
            
            // Clear current input
            for (let i = 0; i < inputBuffer.length; i++) {
              term.write('\b \b');
            }
            
            // Write historical command
            inputBuffer = historicalCommand;
            term.write(historicalCommand);
          } else if (tempHistoryIndex === 0) {
            tempHistoryIndex = -1;
            
            // Clear current input
            for (let i = 0; i < inputBuffer.length; i++) {
              term.write('\b \b');
            }
            inputBuffer = '';
          }
          return;
        } else if (escapeSequence.length > 3) {
          // Reset if sequence is too long
          escapeSequence = '';
        }
        return;
      }
      
      const char = data.charCodeAt(0);
      
      if (char === 27) { // Escape key - start of escape sequence
        escapeSequence = data;
        return;
      } else if (char === 13) { // Enter key
        if (inputBuffer.trim()) {
          term.write('\r\n');
          const command = inputBuffer.trim();
          
          // Add to command history
          setCommandHistory(prev => {
            const newHistory = [command, ...prev.slice(0, 49)]; // Keep last 50 commands
            return newHistory;
          });
          setHistoryIndex(-1);
          tempHistoryIndex = -1;
          
          processCommand(command);
          inputBuffer = '';
        } else {
          term.write('\r\n');
          showPrompt();
        }
      } else if (char === 127 || char === 8) { // Backspace/Delete
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          term.write('\b \b');
        }
      } else if (char === 9) { // Tab key
        // Basic tab completion for commands
        if (inputBuffer.length > 0) {
          const commands = ['help', 'login', 'register', 'boards', 'enter', 'exit', 'post', 'reply', 'read', 'list', 'who', 'msg', 'info', 'bulletins', 'logout', 'quit'];
          const matches = commands.filter(cmd => cmd.startsWith(inputBuffer.toLowerCase()));
          
          if (matches.length === 1) {
            const completion = matches[0].substring(inputBuffer.length);
            inputBuffer += completion;
            term.write(completion);
          } else if (matches.length > 1) {
            term.write('\r\n');
            term.write(`Available: ${matches.join(', ')}`);
            term.write('\r\n');
            showPrompt();
            term.write(inputBuffer);
          }
        }
      } else if (char >= 32 && char <= 126) { // Printable characters
        inputBuffer += data;
        term.write(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddon && xtermRef.current) {
        try {
          fitAddon.fit();
        } catch (error) {
          console.warn('Resize fit failed:', error);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    setIsReady(true);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  const loadWelcomeMessage = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/terminal/welcome');
      if (xtermRef.current) {
        xtermRef.current.write(response.data.text);
        showPrompt();
      }
    } catch (error) {
      console.error('Error loading welcome message:', error);
      if (xtermRef.current) {
        xtermRef.current.write('Error: Could not connect to server\r\n');
        showPrompt();
      }
    }
  };

  const showPrompt = (customPrompt = null) => {
    if (xtermRef.current) {
      const prompt = customPrompt || currentPrompt;
      xtermRef.current.write(`\r\n\x1b[32m${prompt}\x1b[0m`);
    }
  };

  const processCommand = async (command) => {
    try {
      const response = await axios.post('http://localhost:5000/api/terminal/command', {
        command: command,
        sessionId: sessionId
      });
      
      if (xtermRef.current) {
        xtermRef.current.write(response.data.text);
        
        // Update prompt if provided
        if (response.data.prompt) {
          setCurrentPrompt(response.data.prompt);
          showPrompt(response.data.prompt);
        } else {
          showPrompt();
        }
      }
    } catch (error) {
      console.error('Error processing command:', error);
      if (xtermRef.current) {
        xtermRef.current.write('\x1b[31mError: Could not process command\x1b[0m');
        showPrompt();
      }
    }
  };

  return (
    <div className="terminal-wrapper">
      <div className="terminal-container">
        <div 
          ref={terminalRef} 
          className="terminal-screen"
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </div>
  );
};

export default Terminal;