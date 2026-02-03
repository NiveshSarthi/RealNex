const { query } = require('./config/database');

async function checkUserOrg() {
    try {
        console.log('Fetching users...');
        const result = await query('SELECT id, email, organization_id FROM users');

        console.log('Users found:', result.rows.length);
        result.rows.forEach(user => {
            console.log(`User ID: ${user.id}, Email: ${user.email}, Org ID: ${user.organization_id} (Type: ${typeof user.organization_id})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkUserOrg();
