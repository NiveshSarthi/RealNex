const { Pool } = require('pg');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
});

async function fixUsers() {
    try {
        console.log('Fetching users and orgs...');
        const usersRes = await pool.query('SELECT id, email, organization_id FROM users');
        const orgsRes = await pool.query('SELECT id FROM organizations LIMIT 1');

        let defaultOrgId;
        if (orgsRes.rows.length === 0) {
            const newOrg = await pool.query("INSERT INTO organizations (name, email) VALUES ('Default Organization', 'admin@example.com') RETURNING id");
            defaultOrgId = newOrg.rows[0].id;
            console.log('Created Default Organization:', defaultOrgId);
        } else {
            defaultOrgId = orgsRes.rows[0].id;
            console.log('Using existing organization:', defaultOrgId);
        }

        for (const user of usersRes.rows) {
            if (!user.organization_id) {
                console.log(`Fixing organization for user: ${user.email}`);
                await pool.query('UPDATE users SET organization_id = $1 WHERE id = $2', [defaultOrgId, user.id]);
            }
        }

        console.log('All users fixed.');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixUsers();
