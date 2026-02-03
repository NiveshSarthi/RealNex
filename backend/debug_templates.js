const { Pool } = require('pg');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
});

async function checkTemplates() {
    try {
        console.log('--- Templates Data ---');
        const res = await pool.query('SELECT id, name, organization_id, is_approved, type FROM templates');
        console.log(JSON.stringify(res.rows, null, 2));

        if (res.rows.length === 0) {
            console.log('No templates found. Seeding a test template...');
            // Get an org ID
            const orgs = await pool.query('SELECT id FROM organizations LIMIT 1');
            if (orgs.rows.length > 0) {
                const orgId = orgs.rows[0].id;
                await pool.query(`
                    INSERT INTO templates (id, organization_id, name, type, content, is_approved, language)
                    VALUES (gen_random_uuid(), $1, 'Appreciation Offer', 'whatsapp', '{"body": "Hello, thank you for your interest!"}', true, 'en')
                `, [orgId]);
                console.log('Test template seeded.');
            }
        }
    } catch (error) {
        console.error('Check error:', error.message);
    } finally {
        await pool.end();
    }
}

checkTemplates();
