# Admin API Documentation

This document describes all available admin API endpoints for the WebBBS system.

## Authentication

All admin endpoints (except `/api/admin/login`) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /api/admin/login
Login as an admin user.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "display_name": "Administrator",
    "email": "admin@example.com",
    "role": "super_admin"
  },
  "token": "jwt-token-here"
}
```

### User Management

#### GET /api/admin/users
Get all users with pagination and search.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (optional)

#### PUT /api/admin/users/:id
Update user details.

**Request Body:**
```json
{
  "is_active": true,
  "user_level": 5,
  "is_admin": false,
  "role": "moderator"
}
```

#### DELETE /api/admin/users/:id
Delete a user (super_admin only).

#### POST /api/admin/create-admin
Create a new admin user (super_admin only).

**Request Body:**
```json
{
  "username": "newadmin",
  "email": "newadmin@example.com",
  "password": "securepassword",
  "display_name": "New Admin",
  "role": "admin"
}
```

### Board Management

#### GET /api/admin/boards
Get all boards with statistics.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (optional)
- `showInactive` (default: false)

**Response includes:**
- Board details
- Message count
- Unique posters count
- Last activity timestamp

#### POST /api/admin/boards
Create a new board.

**Request Body:**
```json
{
  "name": "New Board",
  "description": "Board description",
  "min_user_level": 1,
  "is_active": true
}
```

#### PUT /api/admin/boards/:id
Update board details.

#### DELETE /api/admin/boards/:id
Delete a board (super_admin only).

**Request Body (optional):**
```json
{
  "moveMessagesTo": 2
}
```

### File Management

#### GET /api/admin/files
Get all files with detailed information.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (optional)
- `area_id` (optional)
- `board_id` (optional)
- `showDeleted` (default: false)
- `needsApproval` (default: false)

#### PUT /api/admin/files/:id/approve
Approve or reject a file.

**Request Body:**
```json
{
  "approved": true,
  "reason": "Approved for public access"
}
```

#### DELETE /api/admin/files/:id/permanent
Permanently delete a file (super_admin only).

#### GET /api/admin/file-areas
Get all file areas with statistics.

#### POST /api/admin/file-areas
Create a new file area.

**Request Body:**
```json
{
  "name": "Documents",
  "description": "Document storage area",
  "min_user_level": 1,
  "max_file_size": 104857600,
  "allowed_extensions": ["pdf", "doc", "docx"],
  "is_active": true
}
```

#### PUT /api/admin/file-areas/:id
Update file area details.

### System Settings

#### GET /api/admin/settings
Get all system settings grouped by category.

#### PUT /api/admin/settings/:key
Update a system setting.

**Request Body:**
```json
{
  "value": "setting-value",
  "category": "general",
  "description": "Setting description"
}
```

#### GET /api/admin/config
Get system configuration information.

### Logging and Monitoring

#### GET /api/admin/logs
Get system logs.

**Query Parameters:**
- `type` (default: 'all')
- `severity` (default: 'all')
- `limit` (default: 100)
- `offset` (default: 0)
- `startDate` (optional)
- `endDate` (optional)
- `userId` (optional)

#### GET /api/admin/audit
Get audit trail of admin actions.

**Query Parameters:**
- `user_id` (optional)
- `activity_type` (optional)
- `limit` (default: 100)
- `offset` (default: 0)
- `startDate` (optional)
- `endDate` (optional)

#### GET /api/admin/metrics
Get system performance metrics.

**Response includes:**
- System uptime and memory usage
- Database connection stats
- User activity statistics
- Message and file statistics

#### GET /api/admin/export/:type
Export system data (super_admin only).

**Valid types:**
- `users`
- `messages`
- `files`
- `boards`
- `activity`
- `full`

### Statistics

#### GET /api/admin/stats
Get system statistics summary.

#### GET /api/admin/activity
Get recent user activity.

**Query Parameters:**
- `limit` (default: 100)

### ANSI Art

#### GET /api/admin/ansi-art
Get ANSI art with pagination and filtering.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (optional)
- `category_id` (optional)

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate name)
- `500` - Internal Server Error

## Activity Logging

All admin actions are automatically logged in the `user_activity` table with:
- User ID
- Activity type
- Activity data (JSON)
- Timestamp

Activity types include:
- `admin_login`
- `admin_user_update`
- `admin_user_delete`
- `admin_board_create`
- `admin_board_update`
- `admin_board_delete`
- `admin_file_approve`
- `admin_file_reject`
- `admin_file_permanent_delete`
- `admin_file_area_create`
- `admin_file_area_update`
- `admin_setting_update`
- `admin_data_export`
- `admin_created`