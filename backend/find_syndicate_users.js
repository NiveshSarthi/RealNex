const { pool } = require('./config/database');
require('dotenv').config();

async function findUsers() {
    try {
        const result = await pool.query("SELECT email FROM users WHERE email ILIKE '%syndicate%'");
        console.log('Syndicate users:');
        result.rows.forEach(user => {
            console.log(`- ${user.email}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

findUsers();
