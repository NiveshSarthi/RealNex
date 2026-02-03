const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'saas_db',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

async function checkDatabase() {
    console.log('Checking database connection...');
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Database connected:', res.rows[0]);

        console.log('Checking workflows table...');
        const tableRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'workflows';
    `);

        if (tableRes.rows.length === 0) {
            console.error('ERROR: workflows table does not exist!');
        } else {
            console.log('workflows table schema:', tableRes.rows);
        }
    } catch (err) {
        console.error('Database error:', err);
    } finally {
        await pool.end();
    }
}

async function checkN8n() {
    const n8nUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
    console.log(`Checking n8n connection at ${n8nUrl}...`);
    try {
        // Try to hit n8n health or workflows endpoint (might fail auth but should connect)
        // Using a public endpoint if possible, or just checking if server responds
        const res = await axios.get(`${n8nUrl}/healthz`).catch(err => {
            if (err.response && err.response.status === 404) {
                console.log('n8n reachable (404 on /healthz is expected if not configured, but connection worked)');
                return { status: 404 };
            }
            throw err;
        });
        console.log('n8n status:', res.status);
    } catch (err) {
        console.error('n8n connection failed:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('HINT: n8n is not running or not listening on port 5678.');
        }
    }
}

async function run() {
    await checkDatabase();
    await checkN8n();
}

run();
