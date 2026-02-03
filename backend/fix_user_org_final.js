const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function fixUserOrg() {
    const badOrgId = '20ce937f-909f-4d7c-8dd5-edb593a07581';
    const goodOrgId = 'c2dd2596-1680-4a95-9621-b9425f61e020';

    try {
        const res = await pool.query(
            'UPDATE users SET organization_id = $1 WHERE organization_id = $2 RETURNING id, email, organization_id',
            [goodOrgId, badOrgId]
        );
        console.log('Updated users:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

fixUserOrg();
