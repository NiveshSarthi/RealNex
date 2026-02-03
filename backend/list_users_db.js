const { pool } = require('./config/database');
require('dotenv').config();

async function listUsers() {
    try {
        const result = await pool.query('SELECT id, email, role FROM users LIMIT 20');
        console.log('Users in DB:');
        result.rows.forEach(user => {
            console.log(`- ${user.email} (${user.role})`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

listUsers();
