const { query } = require('./config/database');

async function seed() {
    try {
        console.log('Seeding approved global templates...');

        const templates = [
            {
                name: 'Welcome Message',
                type: 'broadcast',
                category: 'marketing',
                content: { body: 'Hello {name}, welcome to our platform! How can we help you today?' },
                variables: { name: 'Customer name' },
                is_approved: true,
                is_global: true
            },
            {
                name: 'Property Update',
                type: 'broadcast',
                category: 'real_estate',
                content: { body: 'Hi {name}, a new property matching your preferences just became available in {location}. Check it out here: {link}' },
                variables: { name: 'Customer name', location: 'City name', link: 'Property link' },
                is_approved: true,
                is_global: true
            },
            {
                name: 'Appreciation Offer',
                type: 'broadcast',
                category: 'promotion',
                content: { body: 'Dear {name}, as a token of our appreciation, here is a special 20% discount code for your next purchase: {code}' },
                variables: { name: 'Customer name', code: 'PROMO20' },
                is_approved: true,
                is_global: true
            }
        ];

        for (const t of templates) {
            const queryText = `
                INSERT INTO templates (name, type, category, content, variables, is_approved, is_global, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                ON CONFLICT DO NOTHING
            `;
            await query(queryText, [
                t.name, t.type, t.category, JSON.stringify(t.content), JSON.stringify(t.variables), t.is_approved, t.is_global
            ]);
        }

        console.log('Successfully seeded templates!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
