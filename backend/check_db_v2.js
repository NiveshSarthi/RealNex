const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
});

async function check() {
    let output = '';
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        output += 'Tables: ' + JSON.stringify(res.rows.map(r => r.table_name)) + '\n';

        const schema = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'broadcasts'");
        output += 'Broadcasts columns: ' + JSON.stringify(schema.rows) + '\n';
    } catch (e) {
        output += 'Error: ' + e.message + '\n';
    } finally {
        fs.writeFileSync(path.join(__dirname, 'db_check.txt'), output);
        await pool.end();
    }
}

check();
