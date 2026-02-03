const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { query } = require('./config/database');
const User = require('./models/User');

async function testApiRoute() {
    try {
        console.log('1. Getting a user...');
        const userRes = await query('SELECT * FROM users LIMIT 1');
        if (userRes.rows.length === 0) throw new Error('No user found');
        const userData = userRes.rows[0];
        const user = new User(userData);

        console.log('User:', user.email, 'Org:', user.organizationId);

        // Generate Token manually to bypass login UI
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
            { expiresIn: '1h' }
        );
        console.log('Token generated.');

        const backendUrl = `http://localhost:${process.env.PORT || 5000}`;

        // Test GET /flows (Fetching workflows)
        console.log('\n2. Testing GET /api/workflows...');
        try {
            const getRes = await axios.get(`${backendUrl}/api/workflows`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('GET Success:', getRes.status, getRes.data);
        } catch (err) {
            console.error('GET Failed:', err.response?.status, err.response?.data || err.message);
        }

        // Test POST /flows (Creating workflow)
        console.log('\n3. Testing POST /api/workflows...');
        try {
            const postRes = await axios.post(`${backendUrl}/api/workflows`, {
                name: 'API Test Flow',
                active: false,
                nodes: [],
                settings: { description: 'Created via test script' }
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('POST Success:', postRes.status, postRes.data);
        } catch (err) {
            console.error('POST Failed:', err.response?.status, err.response?.data || err.message);
        }

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        process.exit();
    }
}

testApiRoute();
