# Admin Authentication System

## Overview

The WebBBS admin authentication system provides secure access control for administrative functions with JWT-based authentication and role-based access control (RBAC).

## Features

- JWT-based authentication for admin users
- Role-based access control (RBAC)
- Separate admin login endpoint
- Admin-specific middleware
- Support for multiple admin roles
- Activity logging for audit trails

## Database Schema Updates

Added to the `users` table:
- `is_admin` (BOOLEAN) - Flag to indicate admin status
- `role` (VARCHAR) - User role (e.g., 'user', 'admin', 'super_admin')

## Available Roles

- `user` - Regular user (default)
- `admin` - Administrator with general admin privileges
- `super_admin` - Super administrator with full system access

## API Endpoints

### Admin Authentication

#### POST /api/admin/login
Admin login endpoint that returns a JWT token.

Request:
```json
{
  "username": "admin",
  "password": "password"
}
```

Response:
```json
{
  "success": true,
  "message": "Admin login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "display_name": "Administrator",
    "email": "admin@example.com",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Admin Routes (Protected)

All admin routes require JWT authentication via the `Authorization: Bearer <token>` header.

#### GET /api/admin/users
Get all users with pagination and search.

Query parameters:
- `page` (default: 1)
- `limit` (default: 50)
- `search` (optional)

#### PUT /api/admin/users/:id
Update user information (admin only).

Request body:
```json
{
  "is_active": true,
  "user_level": 10,
  "is_admin": false,
  "role": "user"
}
```

#### DELETE /api/admin/users/:id
Delete a user (super_admin only).

#### GET /api/admin/stats
Get system statistics (admin only).

#### GET /api/admin/activity
Get recent user activity (admin only).

#### POST /api/admin/create-admin
Create a new admin user (super_admin only).

Request body:
```json
{
  "username": "newadmin",
  "email": "newadmin@example.com",
  "password": "securepassword",
  "display_name": "New Administrator",
  "role": "admin"
}
```

## Middleware

### adminAuth
Basic admin authentication middleware that verifies JWT tokens and ensures the user is an admin.

```javascript
const { adminAuth } = require('./middleware/adminAuth');

router.get('/admin-only', adminAuth, (req, res) => {
  // req.admin contains the authenticated admin user
});
```

### requireRole
Role-based access control middleware.

```javascript
const { requireRole } = require('./middleware/adminAuth');

router.delete('/sensitive', requireRole(['super_admin']), (req, res) => {
  // Only super_admin users can access this route
});
```

### General Authentication Middleware

The system also includes general authentication middleware that supports both JWT and session tokens:

```javascript
const { authenticate, optionalAuth } = require('./middleware/auth');

// Require authentication
router.get('/protected', authenticate, (req, res) => {
  // req.user contains the authenticated user
});

// Optional authentication
router.get('/public', optionalAuth, (req, res) => {
  // req.user contains the user if authenticated, undefined otherwise
});
```

## Creating the First Super Admin

To create the initial super admin user, run:

```bash
npm run create-super-admin
```

You can set custom credentials using environment variables:
```bash
SUPER_ADMIN_USERNAME=myusername \
SUPER_ADMIN_EMAIL=myemail@example.com \
SUPER_ADMIN_PASSWORD=mysecurepassword \
npm run create-super-admin
```

Default credentials (if not specified):
- Username: `superadmin`
- Email: `admin@webbs.local`
- Password: `changeme123!`

**Important:** Change the password immediately after first login!

## Environment Variables

Add to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

## Security Considerations

1. Always use HTTPS in production
2. Set a strong JWT_SECRET in production
3. Implement rate limiting on login endpoints
4. Regularly rotate JWT secrets
5. Monitor admin activity logs
6. Implement session timeout for admin users
7. Use strong passwords for admin accounts

## Client Implementation

To use the admin authentication in your frontend:

```javascript
// Admin login
const response = await fetch('/api/admin/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'password'
  })
});

const data = await response.json();
const token = data.token;

// Use token for subsequent requests
const users = await fetch('/api/admin/users', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Activity Logging

All admin actions are logged in the `user_activity` table for audit purposes. This includes:
- Admin logins
- User updates
- User deletions
- Admin creation

Query the activity log:
```sql
SELECT ua.*, u.username 
FROM user_activity ua 
JOIN users u ON ua.user_id = u.id 
WHERE ua.activity_type LIKE 'admin_%' 
ORDER BY ua.created_at DESC;
```