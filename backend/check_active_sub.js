const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkSub() {
    const orgId = 'c2dd2596-1680-4a95-9621-b9425f61e020';
    try {
        const res = await pool.query("SELECT * FROM subscriptions WHERE organization_id = $1", [orgId]);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSub();
