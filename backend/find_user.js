const { pool } = require('./config/database');
require('dotenv').config();

async function findUser() {
    try {
        const email = 'ratnakerkumar56@gmail.com';
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            console.log('User found:', JSON.stringify(result.rows[0], null, 2));
        } else {
            console.log('User not found');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

findUser();
