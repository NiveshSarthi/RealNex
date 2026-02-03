const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkConstraints() {
    try {
        const res = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
      AND (conrelid = 'users'::regclass OR conrelid = 'organizations'::regclass)
    `);
        res.rows.forEach(row => {
            console.log(`${row.conname} (${row.contype}): ${row.pg_get_constraintdef}`);
        });
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkConstraints();
