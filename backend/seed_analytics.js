const { query } = require('./config/database');
const { v4: uuidv4 } = require('uuid');

async function seedAnalytics() {
    try {
        console.log('Seeding analytics data...');

        // Get an organization ID
        const userRes = await query('SELECT organization_id, id FROM users LIMIT 1');
        if (userRes.rows.length === 0) {
            console.log('No users found. Cannot seed.');
            return;
        }
        const orgId = userRes.rows[0].organization_id;

        // Seed Contacts (Leads)
        const statuses = ['new', 'contacted', 'qualified', 'closed', 'lost'];
        const engagement = [30, 60, 90];

        const countRes = await query('SELECT count(*) FROM contacts WHERE organization_id = $1', [orgId]);
        if (parseInt(countRes.rows[0].count) > 0) {
            console.log('Contacts already exist. Seeding additional recent ones...');
        }

        // Always add some fresh data for "Recent Activity"
        for (let i = 0; i < 10; i++) {
            const phone = `9198765${Math.floor(10000 + Math.random() * 90000)}`;
            const contactId = uuidv4();

            await query(`
            INSERT INTO contacts (
                organization_id, contact_id, channel, 
                first_name, last_name, phone, email, 
                engagement_score, custom_fields, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - (random() * interval '7 days'), NOW())
        `, [
                orgId,
                contactId,
                'whatsapp',
                `Lead${i}`,
                `Recent`,
                phone,
                `lead${i}@seed.com`,
                engagement[Math.floor(Math.random() * engagement.length)],
                JSON.stringify({
                    status: statuses[Math.floor(Math.random() * statuses.length)],
                    budget_min: Math.floor(Math.random() * 5000000) + 1000000,
                    location: 'Delhi'
                })
            ]);
        }
        console.log('Contacts seeded.');

        // Seed Conversations & Messages for the new contacts
        // Fetch specifically the ones we just added (or just all top 20)
        const contacts = await query('SELECT id, contact_id FROM contacts WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 15', [orgId]);

        for (const contact of contacts.rows) {
            let convId;
            const convRes = await query('SELECT id FROM conversations WHERE contact_id = $1', [contact.id]);

            if (convRes.rows.length === 0) {
                // REMOVED organization_id because it violates schema
                const newConv = await query(`
                INSERT INTO conversations (contact_id, status, channel, created_at, last_message_at)
                VALUES ($1, 'active', 'whatsapp', NOW() - (random() * interval '7 days'), NOW())
                RETURNING id
            `, [contact.id]);
                convId = newConv.rows[0].id;
            } else {
                convId = convRes.rows[0].id;
            }

            // Add stats count
            const msgDirection = ['inbound', 'outbound'];
            for (let j = 0; j < 5; j++) {
                await query(`
                INSERT INTO messages (conversation_id, direction, message_type, content, status, created_at)
                VALUES ($1, $2, 'text', 'Auto seeded analytics message', 'read', NOW() - (random() * interval '7 days'))
            `, [convId, msgDirection[j % 2]]);
            }
        }

        console.log('Seeding complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seedAnalytics();
