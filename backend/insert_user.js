require('dotenv').config();
const { pool } = require('./config/database');
const bcrypt = require('bcryptjs');

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('DB connected, time:', result.rows[0].now);
  } catch (error) {
    console.error('DB connection error:', error);
  } finally {
    await pool.end();
  }
}

testConnection();