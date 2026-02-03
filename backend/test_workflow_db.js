const { query } = require('./config/database');
const User = require('./models/User');

async function testDbInsertion() {
    try {
        console.log('1. Fetching a user...');
        // Get the first user to simulate req.user
        const userRes = await query('SELECT * FROM users LIMIT 1');
        if (userRes.rows.length === 0) {
            console.error('No users found to test with.');
            return;
        }

        // Normalize user object as middleware does
        const user = new User(userRes.rows[0]);
        console.log('User found:', { id: user.id, organizationId: user.organizationId });

        const workflowData = {
            name: 'Test DB Workflow',
            settings: { description: 'From test script' }
        };
        const n8nResult = { workflowId: 'mock-test-id' };

        console.log('2. Attempting Insert...');
        const result = await query(
            'INSERT INTO workflows (organization_id, name, description, n8n_workflow_id, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [user.organizationId, workflowData.name, workflowData.settings?.description || '', n8nResult.workflowId, 'draft', user.id]
        );

        console.log('Insert Success:', result.rows[0]);

    } catch (error) {
        console.error('Insert Failed:', error);
    } finally {
        process.exit();
    }
}

testDbInsertion();
