const axios = require('axios');

async function verifyCampaigns() {
    const API_URL = 'http://localhost:5000';
    let token;

    try {
        console.log('1. Registering/Logging in test user...');
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        }).catch(async (err) => {
            if (err.response?.status === 401) {
                console.log('User not found, registering...');
                const regRes = await axios.post(`${API_URL}/api/auth/register`, {
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                    businessName: 'Test Biz'
                });
                return regRes;
            }
            throw err;
        });

        token = loginRes.data.data.token;
        console.log('Login successful, token acquired.');

        console.log('\n2. Testing GET /api/broadcasts...');
        const campaignsRes = await axios.get(`${API_URL}/api/broadcasts`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Status:', campaignsRes.status);
        console.log('Campaigns count:', campaignsRes.data.data.length);

        console.log('\n3. Testing GET /api/broadcasts/stats/overview...');
        const statsRes = await axios.get(`${API_URL}/api/broadcasts/stats/overview`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Status:', statsRes.status);
        console.log('Stats:', JSON.stringify(statsRes.data.data, null, 2));

        console.log('\nVerification complete!');
    } catch (error) {
        console.error('Verification failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

verifyCampaigns();
