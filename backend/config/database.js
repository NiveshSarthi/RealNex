const { Pool } = require('pg');
require('dotenv').config();

let pool;
let isConnected = false;

// PostgreSQL connection pool
try {
  pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased to 10s
  });

  pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
    isConnected = true;
  });

  pool.on('error', (err) => {
    console.error('Database connection error:', err.message);
    isConnected = false;
  });
} catch (error) {
  console.error('Failed to create database pool:', error.message);
  isConnected = false;
}

// Query helper function with retry logic
const query = async (text, params, retries = 3) => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const start = Date.now();
  for (let i = 0; i < retries; i++) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
      return res;
    } catch (err) {
      const isTransient = err.message.includes('Connection terminated') ||
        err.message.includes('timeout') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('Database not available');

      if (isTransient && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        console.warn(`Query failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms:`, err.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Query error after', i + 1, 'attempts:', err.message);
      throw err;
    }
  }
};

module.exports = {
  pool,
  query,
  isConnected: () => isConnected,
};