const { pool } = require('./config/database');
require('dotenv').config();

async function findUsers() {
    try {
        const emails = ['ratnakerkumar56@gmail.com', 'admin@syndicate.com'];
        for (const email of emails) {
            const result = await pool.query('SELECT id, email, first_name, last_name, role FROM users WHERE email = $1', [email]);
            if (result.rows.length > 0) {
                console.log(`User found (${email}):`, JSON.stringify(result.rows[0], null, 2));
            } else {
                console.log(`User not found (${email})`);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

findUsers();
