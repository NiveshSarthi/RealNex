const { pool } = require('./config/database');

const testQueries = async () => {
    try {
        // Get an organization
        const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
        if (orgRes.rows.length === 0) {
            console.log('No organizations found. Creating one...');
            // Create stub org if missing
            await pool.query("INSERT INTO organizations (name, domain) VALUES ('Test Org', 'test.com')");
            // Retry
            return testQueries();
        }
        const organizationId = orgRes.rows[0].id;
        console.log('Testing with Organization ID:', organizationId);

        // 1. Conversations
        console.log('Query 1: Conversations');
        await pool.query(
            'SELECT COUNT(*) as total_conversations FROM conversations WHERE organization_id = $1',
            [organizationId]
        );
        console.log('Query 1: OK');

        // 2. Messages
        console.log('Query 2: Messages');
        await pool.query(
            'SELECT COUNT(*) as total_messages FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.organization_id = $1',
            [organizationId]
        );
        console.log('Query 2: OK');

        // 3. Contacts
        console.log('Query 3: Contacts');
        await pool.query(
            'SELECT COUNT(*) as total_contacts FROM contacts WHERE organization_id = $1',
            [organizationId]
        );
        console.log('Query 3: OK');

        console.log('All queries passed!');
        process.exit(0);
    } catch (error) {
        console.error('Query Failed:', error);
        process.exit(1);
    }
};

testQueries();
