const { Pool } = require('pg');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
    connectionTimeoutMillis: 5000
});

async function run() {
    try {
        console.log('Querying users and orgs...');
        const users = await pool.query('SELECT id, email, organization_id FROM users');
        console.log('Users:', JSON.stringify(users.rows, null, 2));

        const orgs = await pool.query('SELECT id, name FROM organizations');
        console.log('Orgs:', JSON.stringify(orgs.rows, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

run();
