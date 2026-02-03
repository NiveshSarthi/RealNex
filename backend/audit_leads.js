const { Pool } = require('pg');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
});

async function audit() {
    try {
        const users = await pool.query('SELECT email, organization_id FROM users');
        for (const user of users.rows) {
            const q = await pool.query('SELECT COUNT(*) FROM contacts WHERE organization_id = $1', [user.organization_id]);
            console.log(`User ${user.email} has ${q.rows[0].count} leads.`);
        }
    } catch (error) {
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

audit();
