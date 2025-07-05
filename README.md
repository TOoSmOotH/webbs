# WEBBS - Web-Based Bulletin Board System

A modern web-based BBS (Bulletin Board System) that recreates the classic terminal experience using modern web technologies.

## Technology Stack

- **Frontend**: React.js with xterm.js for terminal emulation
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Real-time Communication**: Socket.io
- **Terminal Display**: 80x25 character display with ANSI support

## Project Structure

```
webbs/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.js
│   │   │   ├── Terminal.js
│   │   │   └── *.css
│   │   ├── App.js
│   │   └── index.js
│   ├── public/
│   └── package.json
├── backend/            # Node.js backend server
│   ├── config/
│   │   └── database.js
│   ├── routes/
│   │   ├── terminal.js
│   │   └── users.js
│   ├── server.js
│   └── package.json
└── package.json        # Root package.json for concurrent development
```

## Features Implemented

- **Terminal Interface**: Full xterm.js integration with 80x25 character display
- **ANSI Color Support**: Full ANSI escape sequence support for colors and formatting
- **Real-time Communication**: WebSocket integration for live terminal interaction
- **Retro Styling**: Authentic terminal aesthetic with scanlines and phosphor glow effects
- **User System**: Registration, login, and authentication
- **Message Boards**: Create posts, reply to messages, and browse discussions
- **File System**: Upload/download files with modern long filename support
  - Secure HTTPS file transfers
  - File areas with type restrictions
  - SHA-256 checksums for integrity
  - Terminal commands: `files`, `areas`, `download`
- **Database Integration**: PostgreSQL with full schema for users, messages, boards, and files
- **Responsive Design**: Terminal adapts to different screen sizes while maintaining aspect ratio
- **Modern Admin Interface**: Separate admin panel at /admin with Material-UI
  - User management with role-based access control
  - ANSI art upload and management system
  - Visual menu builder with 80x25 grid editor
  - Board and file administration
  - Real-time monitoring dashboard

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Docker and Docker Compose

### One-Command Startup

```bash
./start.sh
```

This script will:
1. Check for Docker and Docker Compose
2. Start PostgreSQL in a Docker container
3. Install all dependencies (if needed)
4. Create a `.env` file with default settings (if missing)
5. Initialize database tables and create admin user
6. Start both frontend and backend servers

### Default Admin Credentials
After running `./start.sh`, a default admin account is created:
- Username: `admin`
- Password: `changeme123`
- **Important**: Change this password immediately via the admin panel

### Manual Installation

1. Start the database:
```bash
docker-compose up -d
```

2. Install all dependencies:
```bash
npm run install-all
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env if you need custom settings
```

4. Start the development servers:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- PostgreSQL: localhost:5432

## Database Setup

The application uses PostgreSQL running in Docker. The database schema is automatically created on first startup. Default credentials (for development only):
- Database: `webbs`
- User: `webbs_user`
- Password: `webbs_pass`

To stop the database:
```bash
docker-compose down
```

To stop and remove all data:
```bash
docker-compose down -v
```

## Current Status

This is the foundational implementation with:
- Working terminal interface
- Basic command processing
- Real-time WebSocket communication
- Database schema in place
- Retro terminal styling with effects

The system is ready for expansion with additional BBS features like user authentication, message boards, file transfers, and more advanced terminal applications.