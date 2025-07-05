const bcrypt = require('bcrypt');
const db = require('../config/database');
require('dotenv').config();

async function createSuperAdmin() {
  try {
    // Check if any super admin exists
    const existingCheck = await db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'super_admin'"
    );
    
    if (parseInt(existingCheck.rows[0].count) > 0) {
      console.log('A super admin already exists. For security reasons, only one super admin can be created via this script.');
      process.exit(0);
    }
    
    // Get credentials from environment or use defaults
    const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@webbs.local';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'changeme123!';
    
    // Check if username or email already exists
    const userCheck = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (userCheck.rows.length > 0) {
      console.log('Username or email already exists. Please choose different credentials.');
      process.exit(1);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create super admin
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin, role, user_level) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, username, email`,
      [username, email, passwordHash, 'Super Administrator', true, 'super_admin', 999]
    );
    
    console.log('Super admin created successfully!');
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nIMPORTANT: Please change the password immediately after first login!');
    console.log('\nYou can set custom credentials using environment variables:');
    console.log('SUPER_ADMIN_USERNAME=yourname');
    console.log('SUPER_ADMIN_EMAIL=your@email.com');
    console.log('SUPER_ADMIN_PASSWORD=yourpassword');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
}

// Run the script
createSuperAdmin();