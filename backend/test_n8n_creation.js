const n8nService = require('./services/n8n');

async function testN8n() {
    console.log('Testing N8N Service...');
    console.log('Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        N8N_API_KEY: process.env.N8N_API_KEY ? 'Set' : 'Not Set'
    });

    try {
        // Test List
        console.log('1. Testing listWorkflows...');
        const listRes = await n8nService.listWorkflows();
        console.log('List Result:', JSON.stringify(listRes, null, 2));

        // Test Create
        console.log('\n2. Testing createWorkflow...');
        const createRes = await n8nService.createWorkflow({
            name: 'Test Flow',
            nodes: [],
            connections: {},
            settings: {}
        });
        console.log('Create Result:', JSON.stringify(createRes, null, 2));

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testN8n();
