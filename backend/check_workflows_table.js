const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkTable() {
    try {
        console.log('Checking workflows table...');
        const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'workflows'
    `);

        if (res.rows.length === 0) {
            console.log('TABLE "workflows" DOES NOT EXIST.');
        } else {
            console.log('Table "workflows" exists. Schema:');
            console.table(res.rows);
        }
    } catch (err) {
        console.error('Database query error:', err);
    } finally {
        await pool.end();
    }
}

checkTable();
