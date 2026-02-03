const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function check() {
    let output = '';

    const users = ['synditech', 'postgres'];
    const passwords = ['synditech_password', 'password', ''];

    for (const user of users) {
        for (const pwd of passwords) {
            const pool = new Pool({
                host: 'localhost',
                port: 5432,
                database: 'synditech_dev',
                user: user,
                password: pwd,
            });

            try {
                output += `--- Trying User: ${user}, Pwd: ${pwd} ---\n`;
                const res = await pool.query("SELECT 1");
                output += 'Success!\n';
                const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
                output += 'Tables: ' + JSON.stringify(tables.rows.map(r => r.table_name)) + '\n';
                await pool.end();
                break;
            } catch (e) {
                output += 'Error: ' + e.message + '\n';
            } finally {
                await pool.end();
            }
        }
    }

    fs.writeFileSync(path.join(__dirname, 'db_check_brute.txt'), output);
}

check();
