const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkUser() {
    try {
        const email = 'ratnakerkumar56@gmail.com';
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        console.log(`User with email '${email}' exists:`, res.rows.length > 0);
        if (res.rows.length > 0) {
            console.log('User details:', JSON.stringify(res.rows[0], null, 2));
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkUser();
