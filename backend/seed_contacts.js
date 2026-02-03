const { query } = require('./config/database');

async function seedContacts() {
    const orgId = 'c2dd2596-1680-4a95-9621-b9425f61e020';

    console.log(`Seeding contacts for organization: ${orgId}`);

    const contacts = [
        {
            contact_id: 'wa_919876543210',
            channel: 'whatsapp',
            whatsapp_number: '919876543210',
            phone: '919876543210',
            email: 'john.doe@example.com',
            first_name: 'John',
            last_name: 'Doe',
            tags: ['interested', 'real_estate']
        },
        {
            contact_id: 'wa_919876543211',
            channel: 'whatsapp',
            whatsapp_number: '919876543211',
            phone: '919876543211',
            email: 'jane.smith@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
            tags: ['new_lead']
        },
        {
            contact_id: 'wa_919876543212',
            channel: 'whatsapp',
            whatsapp_number: '919876543212',
            phone: '919876543212',
            email: 'robert.brown@example.com',
            first_name: 'Robert',
            last_name: 'Brown',
            tags: ['vip', 'high_score']
        },
        {
            contact_id: 'wa_919876543213',
            channel: 'whatsapp',
            whatsapp_number: '919876543213',
            phone: '919876543213',
            email: 'sarah.jones@example.com',
            first_name: 'Sarah',
            last_name: 'Jones',
            tags: ['buyer', 'urgent']
        }
    ];

    try {
        for (const c of contacts) {
            const queryText = `
                INSERT INTO contacts (
                    organization_id, contact_id, channel, whatsapp_number, 
                    phone, email, first_name, last_name, tags, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                ON CONFLICT (contact_id, channel, organization_id) DO UPDATE SET
                    whatsapp_number = EXCLUDED.whatsapp_number,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    tags = EXCLUDED.tags,
                    updated_at = NOW()
            `;
            await query(queryText, [
                orgId, c.contact_id, c.channel, c.whatsapp_number,
                c.phone, c.email, c.first_name, c.last_name, c.tags
            ]);
        }
        console.log('Successfully seeded 4 contacts!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding contacts failed:', error);
        process.exit(1);
    }
}

seedContacts();
