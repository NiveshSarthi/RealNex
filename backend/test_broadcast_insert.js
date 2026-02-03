const { Pool } = require('pg');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
});

async function testCreate() {
    try {
        const user = await pool.query('SELECT id, organization_id FROM users LIMIT 1');
        if (user.rows.length === 0) {
            console.log('No users found.');
            return;
        }

        const template = await pool.query('SELECT id FROM templates LIMIT 1');
        const templateId = template.rows.length > 0 ? template.rows[0].id : null;

        console.log('Testing INSERT with:', {
            org: user.rows[0].organization_id,
            user: user.rows[0].id,
            templateId
        });

        const queryText = `
            INSERT INTO broadcasts (
                organization_id, name, description, template_id,
                audience_filters, status, scheduled_at, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const values = [
            user.rows[0].organization_id,
            'Test Campaign ' + Date.now(),
            'Test Desc',
            templateId,
            JSON.stringify({}),
            'draft',
            new Date(),
            user.rows[0].id
        ];

        const result = await pool.query(queryText, values);
        console.log('Success! Created ID:', result.rows[0].id);

    } catch (error) {
        console.error('INSERT FAILED:', error.message);
    } finally {
        await pool.end();
    }
}

testCreate();
