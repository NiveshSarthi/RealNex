const { pool } = require('./config/database');

const checkTable = async () => {
    try {
        const res = await pool.query("SELECT to_regclass('public.messages')");
        console.log('Messages table exists:', res.rows[0].to_regclass !== null);
        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
};

checkTable();
