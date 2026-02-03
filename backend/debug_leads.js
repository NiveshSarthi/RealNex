const { Pool } = require('pg');

const pool = new Pool({
    host: '72.61.248.175',
    port: 5443,
    database: 'postgres',
    user: 'postgres',
    password: 'rr5inCRtzjDCFOQUkv2vrE0WDlnAWhSGhYGq30mxJWeLJYCG9oMVL0L39UjR2FTt',
});

async function seedLeadsForAll() {
    try {
        // Check schema
        const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'organization_id'
    `);
        console.log('Schema for organization_id:', schema.rows[0]);

        const users = await pool.query('SELECT DISTINCT organization_id FROM users');
        console.log(`Found ${users.rows.length} unique organizations.`);

        for (const org of users.rows) {
            const orgId = org.organization_id;
            if (!orgId) continue;

            const existing = await pool.query('SELECT COUNT(*) FROM contacts WHERE organization_id = $1', [orgId]);
            if (parseInt(existing.rows[0].count) === 0) {
                console.log(`Seeding leads for Org: ${orgId}`);

                const leads = [
                    { phone: '910000000021', first: 'John', last: 'Doe' },
                    { phone: '910000000022', first: 'Jane', last: 'Smith' },
                    { phone: '910000000023', first: 'Robert', last: 'Brown' },
                    { phone: '910000000024', first: 'Alice', last: 'Johnson' },
                    { phone: '910000000025', first: 'Michael', last: 'Wilson' }
                ];

                for (const lead of leads) {
                    const contactId = `${lead.phone}_${orgId}`;
                    await pool.query(`
            INSERT INTO contacts (id, organization_id, contact_id, channel, phone, first_name, last_name, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, 'manual', $3, $4, $5, NOW(), NOW())
          `, [orgId, contactId, lead.phone, lead.first, lead.last]);
                }
                console.log(`Successfully seeded 5 leads for Org: ${orgId}`);
            } else {
                console.log(`Org: ${orgId} already has ${existing.rows[0].count} leads.`);
            }
        }
        console.log('Seeding process complete!');
    } catch (error) {
        console.error('Seeding error:', error.message);
    } finally {
        await pool.end();
    }
}

seedLeadsForAll();
