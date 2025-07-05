const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Store terminal sessions (in-memory for now)
const terminalSessions = new Map();

// Helper function to get user session
const getUserSession = (sessionId) => {
  return terminalSessions.get(sessionId);
};

// Helper function to update user session
const updateUserSession = (sessionId, data) => {
  const existing = terminalSessions.get(sessionId) || {};
  terminalSessions.set(sessionId, { ...existing, ...data });
};

// Get terminal welcome message
router.get('/welcome', async (req, res) => {
  try {
    const welcomeMessage = `
\x1b[32m████████████████████████████████████████████████████████████████████████████████
█                                                                              █
█  ██╗    ██╗███████╗██████╗ ██████╗ ███████╗    ██╗   ██╗ ██╗    ██████╗    █
█  ██║    ██║██╔════╝██╔══██╗██╔══██╗██╔════╝    ██║   ██║███║   ██╔═████╗   █
█  ██║ █╗ ██║█████╗  ██████╔╝██████╔╝███████╗    ██║   ██║╚██║   ██║██╔██║   █
█  ██║███╗██║██╔══╝  ██╔══██╗██╔══██╗╚════██║    ╚██╗ ██╔╝ ██║   ████╔╝██║   █
█  ╚███╔███╔╝███████╗██████╔╝██████╔╝███████║     ╚████╔╝  ██║██╗╚██████╔╝   █
█   ╚══╝╚══╝ ╚══════╝╚═════╝ ╚═════╝ ╚══════╝      ╚═══╝   ╚═╝╚═╝ ╚═════╝    █
█                                                                              █
█\x1b[36m                    W E B - B A S E D   B U L L E T I N   B O A R D\x1b[32m           █
████████████████████████████████████████████████████████████████████████████████\x1b[0m

\x1b[33m┌─────────────────────────────────────────────────────────────────────────────┐
│                            \x1b[36mSYSTEM COMMANDS\x1b[33m                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  \x1b[37mhelp\x1b[33m ......... Show available commands    \x1b[37mwho\x1b[33m ........... Users online     │
│  \x1b[37mlogin\x1b[33m ........ Login to your account     \x1b[37mbulletins\x1b[33m ..... System messages  │
│  \x1b[37mregister\x1b[33m ..... Create a new account      \x1b[37mfiles\x1b[33m ......... Browse files     │
│  \x1b[37mboards\x1b[33m ....... List message boards       \x1b[37mquit\x1b[33m .......... Exit system      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘\x1b[0m

\x1b[32m▸\x1b[0m \x1b[36mConnected to WEBBS Terminal Server\x1b[0m
\x1b[32m▸\x1b[0m \x1b[36mType any command to begin\x1b[0m

\x1b[32mBBS>\x1b[0m `;

    res.json({
      text: welcomeMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting welcome message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process terminal commands
router.post('/command', async (req, res) => {
  try {
    const { command, args, sessionId } = req.body;
    const userSession = getUserSession(sessionId) || {};
    
    let response = '';
    let newSession = { ...userSession };
    
    const [cmd, ...cmdArgs] = command.split(' ');
    
    switch (cmd.toLowerCase()) {
      case 'help':
        if (userSession.user) {
          response = `
\x1b[36m╔══════════════════════════════════════════════════════════════════════════════╗
║                           \x1b[33mUSER COMMAND REFERENCE\x1b[36m                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║ \x1b[33mMESSAGE BOARDS\x1b[36m                          \x1b[33mFILE SYSTEM\x1b[36m                         ║
║ ─────────────                          ───────────                         ║
║ \x1b[37mboards\x1b[36m ....... List all boards          \x1b[37mfiles\x1b[36m ........ List files          ║
║ \x1b[37menter\x1b[36m ........ Enter a board            \x1b[37mareas\x1b[36m ........ File categories     ║
║ \x1b[37mexit\x1b[36m ......... Leave current board      \x1b[37mdownload\x1b[36m ..... Get file (HTTPS)    ║
║ \x1b[37mlist\x1b[36m ......... List messages                                              ║
║ \x1b[37mread\x1b[36m ......... Read a message           \x1b[33mUSER FUNCTIONS\x1b[36m                     ║
║ \x1b[37mpost\x1b[36m ......... Post new message         ─────────────                     ║
║ \x1b[37mreply\x1b[36m ........ Reply to message         \x1b[37mwho\x1b[36m .......... Users online        ║
║                                         \x1b[37minfo\x1b[36m ......... User profile        ║
║ \x1b[33mCOMMUNICATION\x1b[36m                           \x1b[37mmsg\x1b[36m ........... Send private msg   ║
║ ─────────────                          \x1b[37mbulletins\x1b[36m .... System notices      ║
║ \x1b[37mmsg <user>\x1b[36m ... Send private message     \x1b[37mlogout\x1b[36m ....... End session         ║
║ \x1b[37minfo <user>\x1b[36m .. View user profile        \x1b[37mquit\x1b[36m ......... Exit BBS            ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m`;
        } else {
          response = `
\x1b[33m┌─────────────────────────────────────────────────────────────────────────────┐
│                            \x1b[36mGUEST COMMANDS\x1b[33m                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  \x1b[37mhelp\x1b[33m ......... Show this help message    \x1b[37mwho\x1b[33m ........... Users online     │
│  \x1b[37mlogin\x1b[33m ........ Login to your account     \x1b[37mbulletins\x1b[33m ..... System messages  │
│  \x1b[37mregister\x1b[33m ..... Create a new account      \x1b[37mboards\x1b[33m ........ View boards      │
│                                           \x1b[37mquit\x1b[33m .......... Exit system      │
│                                                                             │
│        \x1b[31mLogin or register to access files, post messages, and more!\x1b[33m         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘\x1b[0m`;
        }
        break;

      case 'register':
        if (userSession.user) {
          response = '\x1b[31mYou are already logged in.\x1b[0m';
        } else if (userSession.registering) {
          if (!userSession.regUsername) {
            newSession.regUsername = cmdArgs.join(' ');
            response = '\x1b[33mEnter email address:\x1b[0m';
          } else if (!userSession.regEmail) {
            newSession.regEmail = cmdArgs.join(' ');
            response = '\x1b[33mEnter password:\x1b[0m';
          } else if (!userSession.regPassword) {
            const password = cmdArgs.join(' ');
            newSession.regPassword = password;
            response = '\x1b[33mEnter display name (optional):\x1b[0m';
          } else {
            const displayName = cmdArgs.join(' ') || userSession.regUsername;
            
            try {
              // Validate inputs
              if (!/^[a-zA-Z0-9_]{3,20}$/.test(userSession.regUsername)) {
                response = '\x1b[31mInvalid username. Must be 3-20 characters, letters/numbers/underscores only.\x1b[0m';
                newSession = {};
                break;
              }
              
              if (userSession.regPassword.length < 6) {
                response = '\x1b[31mPassword must be at least 6 characters long.\x1b[0m';
                newSession = {};
                break;
              }
              
              // Check if user exists
              const existingUser = await db.query('SELECT id FROM users WHERE username = $1 OR email = $2',
                [userSession.regUsername, userSession.regEmail]);
              
              if (existingUser.rows.length > 0) {
                response = '\x1b[31mUsername or email already exists.\x1b[0m';
                newSession = {};
                break;
              }
              
              // Hash password and create user
              const passwordHash = await bcrypt.hash(userSession.regPassword, 10);
              const result = await db.query(
                'INSERT INTO users (username, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name',
                [userSession.regUsername, userSession.regEmail, passwordHash, displayName]
              );
              
              response = `
\x1b[35m╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                      \x1b[32m✓ \x1b[33mREGISTRATION SUCCESSFUL! \x1b[32m✓\x1b[35m                         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[36m▸\x1b[0m Welcome to WEBBS, \x1b[33m${result.rows[0].display_name}\x1b[0m!
\x1b[36m▸\x1b[0m Your account has been created successfully.
\x1b[36m▸\x1b[0m Username: \x1b[37m${result.rows[0].username}\x1b[0m

Type \x1b[37mlogin\x1b[0m to access your new account.`;
              newSession = {};
            } catch (error) {
              response = '\x1b[31mRegistration failed. Please try again.\x1b[0m';
              newSession = {};
            }
          }
        } else {
          newSession.registering = true;
          response = '\x1b[33mEnter username:\x1b[0m';
        }
        break;

      case 'login':
        if (userSession.user) {
          response = '\x1b[31mYou are already logged in.\x1b[0m';
        } else if (userSession.logging) {
          if (!userSession.loginUsername) {
            newSession.loginUsername = cmdArgs.join(' ');
            response = '\x1b[33mEnter password:\x1b[0m';
          } else {
            const password = cmdArgs.join(' ');
            
            try {
              const result = await db.query('SELECT * FROM users WHERE username = $1 AND is_active = true',
                [userSession.loginUsername]);
              
              if (result.rows.length === 0) {
                response = '\x1b[31mInvalid username or password.\x1b[0m';
                newSession = {};
                break;
              }
              
              const user = result.rows[0];
              const passwordValid = await bcrypt.compare(password, user.password_hash);
              
              if (!passwordValid) {
                response = '\x1b[31mInvalid username or password.\x1b[0m';
                newSession = {};
                break;
              }
              
              // Update last login
              await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
              
              // Log activity
              await db.query(
                'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
                [user.id, 'user_login', { username: user.username }]
              );
              
              newSession = {
                user: {
                  id: user.id,
                  username: user.username,
                  display_name: user.display_name,
                  user_level: user.user_level
                }
              };
              
              response = `
\x1b[32m╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                           \x1b[33m★ \x1b[36mLOGIN SUCCESSFUL \x1b[33m★\x1b[32m                            ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[36m▸\x1b[0m Welcome back, \x1b[33m${user.display_name}\x1b[0m!
\x1b[36m▸\x1b[0m Last login: \x1b[37m${user.last_login ? new Date(user.last_login).toLocaleString() : 'First login'}\x1b[0m
\x1b[36m▸\x1b[0m Access level: \x1b[32m${user.user_level}\x1b[0m

Type \x1b[37mhelp\x1b[0m to see all available commands.`;
            } catch (error) {
              response = '\x1b[31mLogin failed. Please try again.\x1b[0m';
              newSession = {};
            }
          }
        } else {
          newSession.logging = true;
          response = '\x1b[33mEnter username:\x1b[0m';
        }
        break;

      case 'logout':
        if (!userSession.user) {
          response = '\x1b[31mYou are not logged in.\x1b[0m';
        } else {
          response = `\x1b[32mGoodbye, ${userSession.user.display_name}!\x1b[0m`;
          newSession = {};
        }
        break;

      case 'boards':
        const boards = await db.query('SELECT * FROM boards WHERE is_active = true ORDER BY name');
        response = `\x1b[33mAvailable Message Boards:\x1b[0m\n`;
        if (boards.rows.length === 0) {
          response += '\x1b[31mNo boards available at this time.\x1b[0m';
        } else {
          for (const board of boards.rows) {
            const msgCount = await db.query(
              'SELECT COUNT(*) as count FROM messages WHERE board_id = $1 AND is_deleted = false',
              [board.id]
            );
            response += `  \x1b[37m${board.name}\x1b[0m - ${board.description || 'No description'} (${msgCount.rows[0].count} messages)\n`;
          }
          if (userSession.user) {
            response += '\nType \x1b[37menter <board_name>\x1b[0m to enter a board.';
          }
        }
        break;

      case 'enter':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in to enter boards.\x1b[0m';
        } else if (!cmdArgs[0]) {
          response = '\x1b[31mUsage: enter <board_name>\x1b[0m';
        } else {
          const boardName = cmdArgs.join(' ');
          const board = await db.query('SELECT * FROM boards WHERE name ILIKE $1 AND is_active = true', [boardName]);
          
          if (board.rows.length === 0) {
            response = '\x1b[31mBoard not found.\x1b[0m';
          } else {
            newSession.currentBoard = board.rows[0];
            response = `\x1b[32mEntered board: ${board.rows[0].name}\x1b[0m
${board.rows[0].description || 'No description'}

Type \x1b[37mlist\x1b[0m to see messages, \x1b[37mpost\x1b[0m to create a new message, or \x1b[37mexit\x1b[0m to leave.`;
          }
        }
        break;

      case 'exit':
        if (!userSession.currentBoard) {
          response = '\x1b[31mYou are not in any board.\x1b[0m';
        } else {
          const boardName = userSession.currentBoard.name;
          newSession.currentBoard = null;
          response = `\x1b[32mExited board: ${boardName}\x1b[0m`;
        }
        break;

      case 'list':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in.\x1b[0m';
        } else if (!userSession.currentBoard) {
          response = '\x1b[31mYou must be in a board. Use \x1b[37menter <board_name>\x1b[0m first.\x1b[0m';
        } else {
          const messages = await db.query(`
            SELECT m.*, u.display_name, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.board_id = $1 AND m.is_deleted = false AND m.parent_id IS NULL
            ORDER BY m.created_at DESC
            LIMIT 20
          `, [userSession.currentBoard.id]);
          
          if (messages.rows.length === 0) {
            response = '\x1b[33mNo messages in this board yet.\x1b[0m';
          } else {
            response = `\x1b[33mMessages in ${userSession.currentBoard.name}:\x1b[0m\n`;
            for (const msg of messages.rows) {
              const replyCount = await db.query(
                'SELECT COUNT(*) as count FROM messages WHERE parent_id = $1 AND is_deleted = false',
                [msg.id]
              );
              response += `\x1b[37m[${msg.id}]\x1b[0m ${msg.subject || 'No Subject'} - by ${msg.display_name} (${replyCount.rows[0].count} replies)\n`;
            }
            response += '\nType \x1b[37mread <message_id>\x1b[0m to read a message.';
          }
        }
        break;

      case 'read':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in.\x1b[0m';
        } else if (!cmdArgs[0]) {
          response = '\x1b[31mUsage: read <message_id>\x1b[0m';
        } else {
          const messageId = parseInt(cmdArgs[0]);
          const message = await db.query(`
            SELECT m.*, u.display_name, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = $1 AND m.is_deleted = false
          `, [messageId]);
          
          if (message.rows.length === 0) {
            response = '\x1b[31mMessage not found.\x1b[0m';
          } else {
            const msg = message.rows[0];
            response = `\x1b[33m[${msg.id}] ${msg.subject || 'No Subject'}\x1b[0m
\x1b[36mFrom: ${msg.display_name} (${msg.username})\x1b[0m
\x1b[36mDate: ${new Date(msg.created_at).toLocaleString()}\x1b[0m

${msg.content}

Type \x1b[37mreply ${msg.id}\x1b[0m to reply to this message.`;
            
            // Show replies
            const replies = await db.query(`
              SELECT m.*, u.display_name, u.username
              FROM messages m
              JOIN users u ON m.user_id = u.id
              WHERE m.parent_id = $1 AND m.is_deleted = false
              ORDER BY m.created_at ASC
            `, [messageId]);
            
            if (replies.rows.length > 0) {
              response += '\n\n\x1b[33mReplies:\x1b[0m';
              for (const reply of replies.rows) {
                response += `\n\x1b[37m[${reply.id}]\x1b[0m ${reply.display_name}: ${reply.content.substring(0, 100)}${reply.content.length > 100 ? '...' : ''}`;
              }
            }
          }
        }
        break;

      case 'post':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in.\x1b[0m';
        } else if (!userSession.currentBoard) {
          response = '\x1b[31mYou must be in a board. Use \x1b[37menter <board_name>\x1b[0m first.\x1b[0m';
        } else if (userSession.posting) {
          if (!userSession.postSubject) {
            newSession.postSubject = cmdArgs.join(' ');
            response = '\x1b[33mEnter message content:\x1b[0m';
          } else {
            const content = cmdArgs.join(' ');
            try {
              await db.query(
                'INSERT INTO messages (user_id, board_id, subject, content) VALUES ($1, $2, $3, $4)',
                [userSession.user.id, userSession.currentBoard.id, userSession.postSubject, content]
              );
              response = '\x1b[32mMessage posted successfully!\x1b[0m';
              newSession.posting = false;
              newSession.postSubject = null;
            } catch (error) {
              response = '\x1b[31mFailed to post message. Please try again.\x1b[0m';
              newSession.posting = false;
              newSession.postSubject = null;
            }
          }
        } else {
          newSession.posting = true;
          response = '\x1b[33mEnter message subject:\x1b[0m';
        }
        break;

      case 'reply':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in.\x1b[0m';
        } else if (!cmdArgs[0]) {
          response = '\x1b[31mUsage: reply <message_id>\x1b[0m';
        } else if (userSession.replying) {
          const content = cmdArgs.join(' ');
          try {
            await db.query(
              'INSERT INTO messages (user_id, board_id, parent_id, content) VALUES ($1, $2, $3, $4)',
              [userSession.user.id, userSession.replyBoard, userSession.replyTo, content]
            );
            response = '\x1b[32mReply posted successfully!\x1b[0m';
            newSession.replying = false;
            newSession.replyTo = null;
            newSession.replyBoard = null;
          } catch (error) {
            response = '\x1b[31mFailed to post reply. Please try again.\x1b[0m';
            newSession.replying = false;
            newSession.replyTo = null;
            newSession.replyBoard = null;
          }
        } else {
          const messageId = parseInt(cmdArgs[0]);
          const message = await db.query('SELECT board_id FROM messages WHERE id = $1 AND is_deleted = false', [messageId]);
          
          if (message.rows.length === 0) {
            response = '\x1b[31mMessage not found.\x1b[0m';
          } else {
            newSession.replying = true;
            newSession.replyTo = messageId;
            newSession.replyBoard = message.rows[0].board_id;
            response = '\x1b[33mEnter your reply:\x1b[0m';
          }
        }
        break;

      case 'who':
        const activeUsers = await db.query(`
          SELECT DISTINCT u.username, u.display_name, u.last_login
          FROM users u
          WHERE u.last_login > NOW() - INTERVAL '1 hour'
          ORDER BY u.last_login DESC
        `);
        
        response = '\x1b[33mUsers Online:\x1b[0m\n';
        if (activeUsers.rows.length === 0) {
          response += '  \x1b[37mNo users currently online\x1b[0m';
        } else {
          activeUsers.rows.forEach(user => {
            response += `  \x1b[37m${user.display_name}\x1b[0m (${user.username})\n`;
          });
        }
        response += `\n\x1b[32m${activeUsers.rows.length} user(s) online\x1b[0m`;
        break;

      case 'msg':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in.\x1b[0m';
        } else if (!cmdArgs[0] || !cmdArgs[1]) {
          response = '\x1b[31mUsage: msg <username> <message>\x1b[0m';
        } else {
          const targetUser = cmdArgs[0];
          const message = cmdArgs.slice(1).join(' ');
          
          const user = await db.query('SELECT id FROM users WHERE username = $1', [targetUser]);
          if (user.rows.length === 0) {
            response = '\x1b[31mUser not found.\x1b[0m';
          } else {
            try {
              await db.query(
                'INSERT INTO private_messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
                [userSession.user.id, user.rows[0].id, message]
              );
              response = `\x1b[32mPrivate message sent to ${targetUser}.\x1b[0m`;
            } catch (error) {
              response = '\x1b[31mFailed to send message.\x1b[0m';
            }
          }
        }
        break;

      case 'info':
        const targetUsername = cmdArgs[0] || userSession.user?.username;
        if (!targetUsername) {
          response = '\x1b[31mUsage: info [username]\x1b[0m';
        } else {
          const userInfo = await db.query(
            'SELECT username, display_name, created_at, last_login FROM users WHERE username = $1',
            [targetUsername]
          );
          
          if (userInfo.rows.length === 0) {
            response = '\x1b[31mUser not found.\x1b[0m';
          } else {
            const user = userInfo.rows[0];
            const messageCount = await db.query(
              'SELECT COUNT(*) as count FROM messages WHERE user_id = (SELECT id FROM users WHERE username = $1)',
              [targetUsername]
            );
            
            response = `\x1b[33mUser Information:\x1b[0m
\x1b[37mUsername:\x1b[0m ${user.username}
\x1b[37mDisplay Name:\x1b[0m ${user.display_name}
\x1b[37mJoined:\x1b[0m ${new Date(user.created_at).toLocaleDateString()}
\x1b[37mLast Login:\x1b[0m ${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
\x1b[37mTotal Messages:\x1b[0m ${messageCount.rows[0].count}`;
          }
        }
        break;

      case 'bulletins':
        response = `\x1b[33mSystem Bulletins:\x1b[0m

\x1b[37m[1]\x1b[0m Welcome to WEBBS v1.0!
   This is a fully functional BBS system with message boards,
   private messaging, and user interaction features.

\x1b[37m[2]\x1b[0m Rules and Guidelines:
   - Be respectful to other users
   - No spam or inappropriate content
   - Use appropriate boards for your messages

\x1b[37m[3]\x1b[0m Features Available:
   - Message boards with threading
   - Private messaging system
   - User profiles and statistics
   - Real-time user listing
   - File sharing with HTTPS transfers`;
        break;

      case 'files':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in to view files.\x1b[0m';
        } else {
          let areaFilter = cmdArgs[0];
          let whereClause = '';
          let queryParams = [];
          
          if (areaFilter) {
            const areaResult = await db.query(
              'SELECT id FROM file_areas WHERE name ILIKE $1 AND is_active = true',
              [`%${areaFilter}%`]
            );
            if (areaResult.rows.length > 0) {
              whereClause = ' AND f.file_area_id = $1';
              queryParams = [areaResult.rows[0].id];
            }
          }
          
          const files = await db.query(`
            SELECT f.*, fa.name as area_name, u.username
            FROM files f
            LEFT JOIN file_areas fa ON f.file_area_id = fa.id
            LEFT JOIN users u ON f.uploaded_by = u.id
            WHERE f.is_deleted = false AND (f.is_public = true OR f.uploaded_by = ${userSession.user.id})${whereClause}
            ORDER BY f.created_at DESC
            LIMIT 20
          `, queryParams);
          
          if (files.rows.length === 0) {
            response = '\x1b[33mNo files available.\x1b[0m';
          } else {
            response = `\x1b[33mAvailable Files:\x1b[0m\n`;
            response += '\x1b[36mID    Filename                           Size       Area         Uploader    Downloads\x1b[0m\n';
            response += '\x1b[36m─────────────────────────────────────────────────────────────────────────────────────────\x1b[0m\n';
            
            for (const file of files.rows) {
              const fileSize = file.file_size < 1024*1024 
                ? `${(file.file_size/1024).toFixed(1)}KB`
                : `${(file.file_size/(1024*1024)).toFixed(1)}MB`;
              
              const filename = file.original_filename.length > 30 
                ? file.original_filename.substring(0, 27) + '...'
                : file.original_filename.padEnd(30);
                
              response += `\x1b[37m${file.id.toString().padEnd(5)}\x1b[0m ${filename} ${fileSize.padStart(10)} ${(file.area_name || 'None').padEnd(12)} ${(file.username || 'System').padEnd(11)} ${file.download_count}\n`;
            }
            response += '\nType \x1b[37mdownload <file_id>\x1b[0m to download a file.';
          }
        }
        break;

      case 'areas':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in to view file areas.\x1b[0m';
        } else {
          const areas = await db.query(
            'SELECT * FROM file_areas WHERE is_active = true ORDER BY name'
          );
          
          response = `\x1b[33mFile Areas:\x1b[0m\n`;
          for (const area of areas.rows) {
            const fileCount = await db.query(
              'SELECT COUNT(*) as count FROM files WHERE file_area_id = $1 AND is_deleted = false',
              [area.id]
            );
            const maxSize = area.max_file_size / (1024*1024);
            response += `  \x1b[37m${area.name}\x1b[0m - ${area.description || 'No description'} (${fileCount.rows[0].count} files, max ${maxSize}MB)\n`;
            if (area.allowed_extensions && area.allowed_extensions.length > 0) {
              response += `    Allowed types: ${area.allowed_extensions.join(', ')}\n`;
            }
          }
          response += '\nType \x1b[37mfiles <area_name>\x1b[0m to view files in a specific area.';
        }
        break;

      case 'download':
        if (!userSession.user) {
          response = '\x1b[31mYou must be logged in to download files.\x1b[0m';
        } else if (!cmdArgs[0]) {
          response = '\x1b[31mUsage: download <file_id>\x1b[0m';
        } else {
          const fileId = parseInt(cmdArgs[0]);
          const fileResult = await db.query(
            'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
            [fileId]
          );
          
          if (fileResult.rows.length === 0) {
            response = '\x1b[31mFile not found.\x1b[0m';
          } else {
            const file = fileResult.rows[0];
            if (!file.is_public && file.uploaded_by !== userSession.user.id) {
              response = '\x1b[31mAccess denied.\x1b[0m';
            } else {
              // In a terminal BBS, we would typically initiate a file transfer protocol
              // For the web version, we'll provide a download link
              const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
              const host = process.env.HOST || 'localhost:5000';
              const downloadUrl = `${protocol}://${host}/api/files/download/${file.id}`;
              response = `\x1b[32mFile ready for download:\x1b[0m
\x1b[37mFilename:\x1b[0m ${file.original_filename}
\x1b[37mSize:\x1b[0m ${(file.file_size/(1024*1024)).toFixed(2)}MB
\x1b[37mChecksum:\x1b[0m ${file.checksum}

\x1b[33mDownload URL:\x1b[0m ${downloadUrl}

\x1b[36mNote: File transfers use secure HTTPS protocol.\x1b[0m`;
            }
          }
        }
        break;

      case 'quit':
        response = `
\x1b[35m╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   \x1b[33m██████╗  ██████╗  ██████╗ ██████╗ ██████╗ ██╗   ██╗███████╗██╗\x1b[35m           ║
║   \x1b[33m██╔════╝ ██╔═══██╗██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝██╔════╝██║\x1b[35m           ║
║   \x1b[33m██║  ███╗██║   ██║██║   ██║██║  ██║██████╔╝ ╚████╔╝ █████╗  ██║\x1b[35m           ║
║   \x1b[33m██║   ██║██║   ██║██║   ██║██║  ██║██╔══██╗  ╚██╔╝  ██╔══╝  ╚═╝\x1b[35m           ║
║   \x1b[33m╚██████╔╝╚██████╔╝╚██████╔╝██████╔╝██████╔╝   ██║   ███████╗██╗\x1b[35m           ║
║   \x1b[33m ╚═════╝  ╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝    ╚═╝   ╚══════╝╚═╝\x1b[35m           ║
║                                                                              ║
║                    \x1b[36mThank you for visiting WEBBS v1.0!\x1b[35m                       ║
║                                                                              ║
║                        \x1b[32m● \x1b[37mSession terminated \x1b[32m●\x1b[35m                              ║
║                        \x1b[32m● \x1b[37mConnection closed  \x1b[32m●\x1b[35m                              ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[36mCome back soon!\x1b[0m`;
        newSession = {};
        break;

      default:
        response = `\x1b[31mUnknown command: ${cmd}\x1b[0m
Type \x1b[37mhelp\x1b[0m for available commands.`;
    }
    
    // Update session
    updateUserSession(sessionId, newSession);
    
    res.json({
      text: response,
      timestamp: new Date().toISOString(),
      prompt: getPrompt(newSession)
    });
  } catch (error) {
    console.error('Error processing command:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate context-aware prompt
const getPrompt = (session) => {
  if (session.registering) {
    return 'REG> ';
  } else if (session.logging) {
    return 'LOGIN> ';
  } else if (session.posting) {
    return 'POST> ';
  } else if (session.replying) {
    return 'REPLY> ';
  } else if (session.user && session.currentBoard) {
    return `[${session.currentBoard.name}]${session.user.username}> `;
  } else if (session.user) {
    return `${session.user.username}> `;
  } else {
    return 'BBS> ';
  }
};

module.exports = router;