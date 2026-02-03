const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function check() {
    let output = '';

    // Try Local DB
    const localPool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'synditech_dev',
        user: 'synditech',
        password: 'synditech_password',
    });

    try {
        output += '--- Trying Local DB ---\n';
        const res = await localPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        output += 'Tables: ' + JSON.stringify(res.rows.map(r => r.table_name)) + '\n';

        if (res.rows.some(r => r.table_name === 'broadcasts')) {
            const schema = await localPool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'broadcasts'");
            output += 'Broadcasts columns: ' + JSON.stringify(schema.rows) + '\n';
        } else {
            output += 'Broadcasts table NOT found.\n';
        }
    } catch (e) {
        output += 'Local DB Error: ' + e.message + '\n';
    } finally {
        await localPool.end();
    }

    fs.writeFileSync(path.join(__dirname, 'db_check_local.txt'), output);
}

check();
