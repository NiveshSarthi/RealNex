const { Pool } = require('pg');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
});

async function checkBroadcasts() {
    try {
        console.log('--- Broadcasts columns ---');
        const schema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'broadcasts'
            ORDER BY ordinal_position
        `);
        console.log(JSON.stringify(schema.rows, null, 2));

        const count = await pool.query('SELECT COUNT(*) FROM broadcasts');
        console.log('Total broadcasts:', count.rows[0].count);

    } catch (error) {
        console.error('Check error:', error.message);
    } finally {
        await pool.end();
    }
}

checkBroadcasts();
