# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `npm run dev` - Runs both frontend and backend concurrently (recommended for development)
- `npm run server` - Runs backend server only on port 5000
- `npm run client` - Runs frontend React app only on port 3000
- `npm run install-all` - Installs dependencies for root, backend, and frontend directories

### Building
- `cd frontend && npm run build` - Creates production build of React frontend

### Testing
- `cd frontend && npm test` - Runs React test suite

## Architecture Overview

This is a modern web-based BBS (Bulletin Board System) that recreates the classic terminal BBS experience:

### Technology Stack
- **Frontend**: React.js with xterm.js for terminal emulation
- **Backend**: Express.js with Socket.io for real-time communication
- **Database**: PostgreSQL with automatic table creation
- **Security**: bcrypt for passwords, Helmet for HTTP headers

### Project Structure
```
webbs/
├── backend/          # Express.js server
│   ├── index.js      # Main server entry point with Socket.io
│   ├── models/       # Database models and initialization
│   └── routes/       # API routes (terminal, users, boards)
├── frontend/         # React application
│   ├── src/
│   │   ├── components/  # React components
│   │   └── App.js       # Main app with terminal integration
│   └── public/          # Static assets
└── package.json      # Root package with concurrent scripts
```

### Key Implementation Details

1. **Terminal Interface**: 
   - Uses xterm.js for 80x25 character terminal emulation
   - ANSI color support with retro CRT effects
   - Commands processed via Socket.io for real-time response

2. **Database Schema**:
   - Tables auto-created on startup if missing
   - User authentication with bcrypt-hashed passwords
   - Board and message system for BBS functionality

3. **Real-time Communication**:
   - Socket.io handles terminal commands and broadcasts
   - Client connects on mount and maintains persistent connection
   - Server routes terminal input to appropriate handlers

4. **Environment Configuration**:
   - Requires `.env` file in backend/ with:
     - `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`
     - `JWT_SECRET` for authentication
     - `NODE_ENV` and `PORT` (optional)

### Common Development Tasks

When modifying terminal commands:
- Update `backend/routes/terminal.js` for new command handlers
- Terminal input is processed in `backend/index.js` via Socket.io
- Frontend terminal component is in `frontend/src/components/Terminal.js`

When working with the database:
- Models are in `backend/models/`
- Database automatically initializes tables on server start
- Connection pool is configured in `backend/models/database.js`

When adding new features:
- Follow the existing route structure in `backend/routes/`
- Use Socket.io for real-time features via the existing connection
- Maintain the retro terminal aesthetic in frontend components

### File System Implementation

The BBS includes a modern file sharing system with:

1. **Database Schema**:
   - `files` table: Stores file metadata with 255-char filename support
   - `file_areas` table: Categorizes files (General, Images, Software, etc.)
   - Tracks downloads, checksums, and file permissions

2. **File Storage**:
   - Files stored in `backend/uploads/{area}/` directories
   - Uses multer for handling multipart uploads
   - SHA-256 checksums for file integrity

3. **API Endpoints** (`backend/routes/files.js`):
   - `POST /api/files/upload` - Upload files with validation
   - `GET /api/files/download/:id` - Secure file downloads over HTTPS
   - `GET /api/files/list` - List files with pagination
   - `GET /api/files/areas` - Get available file areas
   - `DELETE /api/files/:id` - Soft delete files

4. **Terminal Commands**:
   - `files [area]` - List available files
   - `areas` - Show file areas and restrictions
   - `download <file_id>` - Get HTTPS download link

5. **Security Features**:
   - File type validation per area
   - Size limits (100MB default, configurable per area)
   - Access control (public/private files)
   - Dangerous file type filtering
   - HTTPS-only transfers in production