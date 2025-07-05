# ANSI Art Upload and Management System

This document describes the ANSI art management system implemented for the WebBBS project.

## Overview

The ANSI art management system allows administrators to upload, categorize, preview, and manage ANSI/ASCII art files commonly used in BBS systems. The system supports traditional ANSI art formats and includes automatic metadata extraction from SAUCE records.

## Features

### Backend Features
- **File Upload Support**: Handles .ans, .asc, .txt, .nfo, and .diz files
- **SAUCE Record Parsing**: Automatically extracts metadata from SAUCE records in ANSI files
- **Database Storage**: Stores ANSI art metadata and references in PostgreSQL
- **Category Management**: Organizes art into predefined categories
- **ANSI to HTML Conversion**: Converts ANSI art to HTML for web preview
- **CP437 Character Support**: Proper handling of DOS/CP437 character encoding

### Frontend Features
- **Admin Interface**: Full CRUD operations for ANSI art management
- **Grid/List Views**: Toggle between grid and list display modes
- **Search and Filter**: Search by title, artist, group, or filename
- **Category Filtering**: Filter art by category
- **Preview System**: In-browser preview of ANSI art
- **Metadata Editing**: Edit title, artist, group, year, and description

## Database Schema

### ansi_art_categories Table
- `id`: Primary key
- `name`: Category name (unique)
- `description`: Category description
- `display_order`: Sort order for display
- `is_active`: Active status
- `created_at`: Creation timestamp

### ansi_art Table
- `id`: Primary key
- `filename`: Stored filename
- `original_filename`: Original uploaded filename
- `file_path`: Relative path to file
- `file_size`: File size in bytes
- `width`: Character width (from SAUCE or default 80)
- `height`: Character height (from SAUCE or default 25)
- `title`: Art title
- `artist`: Artist name
- `group_name`: Art group name
- `year`: Year created
- `description`: Description text
- `category_id`: Foreign key to categories
- `uploaded_by`: Foreign key to users
- `view_count`: Number of views
- `is_active`: Active status
- `is_deleted`: Soft delete flag
- `sauce_info`: SAUCE record data (JSON)
- `metadata`: Additional metadata (JSON)
- `created_at`: Upload timestamp
- `updated_at`: Last update timestamp

## API Endpoints

### Public Endpoints
- `GET /api/ansi-art/list` - List ANSI art with filtering
- `GET /api/ansi-art/:id` - Get single ANSI art details
- `GET /api/ansi-art/:id/raw` - Get raw ANSI file
- `GET /api/ansi-art/:id/preview` - Get HTML preview
- `GET /api/ansi-art/categories/list` - List categories

### Admin Endpoints
- `POST /api/ansi-art/upload` - Upload new ANSI art (admin only)
- `PUT /api/ansi-art/:id` - Update ANSI art metadata (admin only)
- `DELETE /api/ansi-art/:id` - Soft delete ANSI art (admin only)
- `GET /api/admin/ansi-art` - Get ANSI art for admin panel

## Default Categories

1. **Welcome Screens** - Welcome and login screens
2. **Main Menus** - Main menu screens
3. **Headers** - Section headers and banners
4. **Footers** - Footer graphics
5. **Backgrounds** - Background patterns and screens
6. **Logos** - BBS and group logos
7. **Transitions** - Screen transition graphics
8. **Info Screens** - Information and help screens
9. **User Lists** - User listing decorations
10. **File Lists** - File area decorations
11. **Message Areas** - Message area headers
12. **Special Events** - Holiday and special event screens
13. **ASCII Art** - ASCII-based artwork
14. **Misc** - Miscellaneous ANSI art

## File Structure

```
backend/
├── routes/
│   └── ansiArt.js          # ANSI art API routes
├── utils/
│   └── ansiToHtml.js       # ANSI to HTML converter
└── uploads/
    └── ansi_art/           # ANSI art storage
        ├── temp/           # Temporary upload directory
        ├── welcome_screens/
        ├── main_menus/
        ├── headers/
        └── ... (category directories)

frontend/src/admin/
├── pages/
│   └── AnsiArt.js          # ANSI art admin interface
└── AdminRouter.js          # Updated with ANSI art route
```

## Usage

### Uploading ANSI Art

1. Navigate to Admin Panel → ANSI Art
2. Click "Upload ANSI Art" button
3. Select an ANSI file (.ans, .asc, .txt)
4. Optionally fill in metadata (title, artist, group, year)
5. Select a category
6. Click Upload

The system will:
- Parse SAUCE records if present
- Extract metadata automatically
- Store the file in the appropriate category directory
- Generate preview capabilities

### Viewing ANSI Art

- **Grid View**: Visual card-based layout
- **List View**: Tabular data display
- **Preview**: Click preview icon to see HTML rendering
- **Download**: Click download icon to get raw ANSI file

### Managing ANSI Art

- **Edit**: Update metadata and category
- **Delete**: Soft delete (file remains but is marked deleted)
- **Search**: Find art by title, artist, group, or filename
- **Filter**: Filter by category

## Technical Details

### SAUCE Record Support

The system automatically parses SAUCE (Standard Architecture for Universal Comment Extensions) records from ANSI files to extract:
- Title
- Author/Artist
- Group
- Date
- Character dimensions (width/height)
- File type information

### Character Encoding

The system properly handles CP437 (DOS) character encoding, including:
- Box drawing characters
- Block characters
- Special symbols
- Extended ASCII characters

### ANSI to HTML Conversion

The converter supports:
- Standard 16 ANSI colors
- Bold/bright colors
- Background colors
- Blink animation (CSS)
- Proper character width/height
- CP437 to Unicode mapping

## Security Considerations

- File upload restricted to admin users only
- File type validation (only ANSI-related extensions)
- File size limit (5MB default)
- Soft delete preserves files while hiding from public
- Proper path sanitization to prevent directory traversal

## Future Enhancements

Potential improvements could include:
- Thumbnail generation for grid view
- Batch upload support
- Import from ANSI art packs (ZIP files)
- Public gallery view for non-admin users
- Download statistics
- Favorite/rating system
- ANSI animation support
- Export to various formats (PNG, SVG)
- Integration with terminal emulator for native viewing