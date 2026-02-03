const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function verify() {
    try {
        const email = `test_pay_${Date.now()}@example.com`;
        console.log('1. Registering new user...');
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            name: 'Payment Tester',
            email: email,
            password: 'password123',
            whatsappNumber: '9998887776'
        });
        token = regRes.data.data.token;
        const headers = { Authorization: `Bearer ${token}` };

        console.log('2. Testing Plans API...');
        const plansRes = await axios.get(`${API_URL}/subscriptions/plans`);
        console.log('[PASS] Plans:', plansRes.data.data.length);

        console.log('3. Testing Stats API...');
        const statsRes = await axios.get(`${API_URL}/subscriptions/my/stats`, { headers });
        console.log('[PASS] Stats:', statsRes.data.data);

        console.log('4. Testing History API...');
        const historyRes = await axios.get(`${API_URL}/subscriptions/my/history`, { headers });
        console.log('[PASS] History count:', historyRes.data.data.length);

        console.log('5. Testing Methods API...');
        const methodsRes = await axios.get(`${API_URL}/subscriptions/methods`, { headers });
        console.log('[PASS] Methods:', methodsRes.data.data.length);

        console.log('--- Verification Successful ---');
    } catch (e) {
        console.error('Verification Failed:', e.message, e.response?.data);
    }
}

verify();
