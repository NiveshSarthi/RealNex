const { pool } = require('../config/database');
require('dotenv').config();

async function checkUser(email) {
    try {
        // Using ILIKE to find it even if case differs
        const result = await pool.query('SELECT id, email, phone, is_active FROM users WHERE email ILIKE $1', [email]);
        if (result.rows.length > 0) {
            console.log('User found:');
            const user = result.rows[0];
            console.log(JSON.stringify(user, null, 2));
            console.log('Email Details:');
            console.log(`- Exact: "${user.email}"`);
            console.log(`- Length: ${user.email.length}`);
            console.log(`- Hex: ${Buffer.from(user.email).toString('hex')}`);

            if (user.email !== email) {
                console.log('WARNING: Email mismatch!');
                console.log(`- Expected: "${email}" (Length: ${email.length})`);
                console.log(`- Found:    "${user.email}" (Length: ${user.email.length})`);
            }
        } else {
            console.log('User not found even with ILIKE.');

            const others = await pool.query('SELECT email FROM users LIMIT 10');
            console.log('Other users in DB:');
            others.rows.forEach(r => {
                console.log(`- "${r.email}" (Len: ${r.email.length}) Hex: ${Buffer.from(r.email).toString('hex')}`);
            });
        }
    } catch (err) {
        console.error('Error checking user:', err.message);
    } finally {
        pool.end();
    }
}

const email = process.argv[2] || 'ratnakerkumar56@gmail.com';
checkUser(email.trim()); // Trim input just in case
