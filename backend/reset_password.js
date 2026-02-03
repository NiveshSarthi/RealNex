const { pool } = require('./config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetPassword() {
    try {
        const email = 'ratnakerkumar56@gmail.com';
        const newPassword = 'password123';
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const result = await pool.query(
            'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email',
            [hashedPassword, email]
        );

        if (result.rows.length > 0) {
            console.log(`Password reset successful for ${email}. New password: ${newPassword}`);
        } else {
            console.log(`User ${email} not found.`);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

resetPassword();
