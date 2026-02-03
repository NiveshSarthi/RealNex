const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkTables() {
    try {
        const tables = ['users', 'organizations'];
        for (const table of tables) {
            const res = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `, [table]);
            console.log(`Table '${table}' exists:`, res.rows[0].exists);

            if (res.rows[0].exists) {
                const columns = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
                console.log(`Columns for '${table}':`);
                columns.rows.forEach(c => {
                    console.log(`  - ${c.column_name} (${c.data_type})`);
                });
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkTables();
