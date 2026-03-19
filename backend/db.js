// FILE: backend/db.js
// MySQL connection pool — imported by all route files
// Usage: const pool = require('../db');
//        const [rows] = await pool.execute('SELECT ...');

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'shopsense_analytics',
  waitForConnections: true,
  connectionLimit:    10,
  timezone:           '+00:00',
});

pool.getConnection()
  .then(conn => { console.log('✅  MySQL connected'); conn.release(); })
  .catch(err  => { console.error('❌  MySQL FAILED:', err.message); process.exit(1); });

module.exports = pool;