const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db } = require('../config/database');

// Admin secret for authentication
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'hvlab-admin-secret-2024';

// Middleware to check admin authentication
const checkAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.substring(7);

  if (token !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid admin credentials' });
  }

  next();
};

// Upload database endpoint
router.post('/upload-database', checkAdminAuth, async (req, res) => {
  try {
    const { database } = req.body;

    if (!database) {
      return res.status(400).json({ error: 'No database data provided' });
    }

    console.log('📦 Receiving database upload...');

    // Decode base64 database
    const dbBuffer = Buffer.from(database, 'base64');
    console.log('Database size:', dbBuffer.length, 'bytes');

    // Get database path from environment or use default
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.db');
    const dbDir = path.dirname(dbPath);

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('✅ Created database directory:', dbDir);
    }

    // Create backup of existing database if it exists
    if (fs.existsSync(dbPath)) {
      const backupPath = `${dbPath}.backup-${Date.now()}`;
      fs.copyFileSync(dbPath, backupPath);
      console.log('✅ Created backup:', backupPath);
    }

    // Close existing database connection
    await new Promise((resolve) => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('✅ Closed existing database connection');
        }
        resolve();
      });
    });

    // Write new database file
    fs.writeFileSync(dbPath, dbBuffer);
    console.log('✅ Database file written successfully');

    res.json({
      success: true,
      message: 'Database uploaded successfully. Please restart the server to use the new database.',
      path: dbPath,
      size: dbBuffer.length
    });

    // Restart server after 2 seconds to load new database
    setTimeout(() => {
      console.log('🔄 Restarting server to load new database...');
      process.exit(0); // Railway will automatically restart the service
    }, 2000);

  } catch (error) {
    console.error('❌ Error uploading database:', error);
    res.status(500).json({
      error: 'Failed to upload database',
      details: error.message
    });
  }
});

// Check database status
router.get('/database-status', checkAdminAuth, (req, res) => {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.db');

  if (!fs.existsSync(dbPath)) {
    return res.json({
      exists: false,
      path: dbPath
    });
  }

  const stats = fs.statSync(dbPath);

  db.get('SELECT COUNT(*) as user_count FROM users', [], (err, userRow) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to query database', details: err.message });
    }

    db.get('SELECT COUNT(*) as project_count FROM projects', [], (err, projectRow) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to query database', details: err.message });
      }

      res.json({
        exists: true,
        path: dbPath,
        size: stats.size,
        modified: stats.mtime,
        users: userRow.user_count,
        projects: projectRow.project_count
      });
    });
  });
});

module.exports = router;
