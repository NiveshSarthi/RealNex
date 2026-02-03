const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function createTable() {
    const queryText = `
    CREATE TABLE IF NOT EXISTS quick_replies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      action VARCHAR(100),
      reply_text TEXT,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    try {
        await pool.query(queryText);
        console.log("Table 'quick_replies' created successfully.");
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

createTable();
