const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool for SyndiTech
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('📊 Connected to SyndiTech PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client:', err);
  process.exit(-1);
});

// Query helper function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`✅ Executed query: ${text.substring(0, 50)}... (${duration}ms)`);
    return res;
  } catch (err) {
    console.error('❌ Query error:', err);
    throw err;
  }
};

module.exports = {
  pool,
  query,
};