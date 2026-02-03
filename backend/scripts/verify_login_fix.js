const { pool } = require('../config/database');
const User = require('../models/User');
require('dotenv').config();

async function verifyFixes() {
    const testEmailLower = 'ratnakerkumar56@gmail.com';
    const testEmailUpper = 'RATNAKERKUMAR56@GMAIL.COM';
    const testEmailMixed = 'RatnakerKumar56@Gmail.Com';

    try {
        console.log('--- Verifying Case-Insensitive Lookup ---');
        const user1 = await User.findByEmail(testEmailLower);
        const user2 = await User.findByEmail(testEmailUpper);
        const user3 = await User.findByEmail(testEmailMixed);

        console.log(`Lookup "${testEmailLower}": ${user1 ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Lookup "${testEmailUpper}": ${user2 ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Lookup "${testEmailMixed}": ${user3 ? 'SUCCESS' : 'FAILED'}`);

        if (user1 && user2 && user3 && user1.id === user2.id && user2.id === user3.id) {
            console.log('✅ PASS: Case-insensitive lookup works correctly.');
        } else {
            console.log('❌ FAIL: Case-insensitive lookup failed.');
        }

    } catch (err) {
        console.error('Verification error:', err.message);
    } finally {
        pool.end();
    }
}

verifyFixes();
