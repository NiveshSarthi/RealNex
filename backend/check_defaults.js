const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkDefaults() {
    try {
        const tables = ['users', 'organizations'];
        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const res = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
            res.rows.forEach(row => {
                console.log(`${row.column_name}: ${row.data_type} (Default: ${row.column_default}, Nullable: ${row.is_nullable})`);
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkDefaults();
