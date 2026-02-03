const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function verify() {
    console.log('--- API Verification Started ---');
    try {
        // 1. Auth - Register/Login
        // 1. Auth - Register/Login
        console.log('1. Authenticating...');
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email: 'test@example.com',
                password: 'password123'
            });
            token = loginRes.data.data.token;
            console.log('[PASS] Login successful');
        } catch (e) {
            console.log('Login failed, trying registration...');
            try {
                const regRes = await axios.post(`${API_URL}/auth/register`, {
                    name: 'Test User',
                    email: `test_${Date.now()}@example.com`,
                    password: 'password123',
                    whatsappNumber: '1234567890'
                });
                token = regRes.data.data.token;
                console.log('[PASS] Registration successful');
            } catch (regError) {
                console.error('Registration failed:', regError.response?.data);
                throw regError;
            }
        }

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Dashboard Overview
        console.log('2. Verifying Dashboard...');
        try {
            const dashRes = await axios.get(`${API_URL}/analytics/overview`, { headers });
            console.log(`[PASS] Dashboard Loaded (Data: ${JSON.stringify(dashRes.data.data)})`);
        } catch (e) {
            console.error(`[FAIL] Dashboard Error: ${e.message}`, e.response?.data);
        }

        // 3. Check New Feature Routes (Ping)
        const routes = ['lms/modules', 'meta-ads/campaigns', 'drip-sequences', 'workflows', 'network'];
        console.log('3. Verifying New Routes...');
        for (const r of routes) {
            try {
                await axios.get(`${API_URL}/${r}`, { headers });
                console.log(`[PASS] Route /api/${r} is active`);
            } catch (e) {
                if (e.response && e.response.status !== 404) {
                    console.log(`[PASS] Route /api/${r} exists (Status: ${e.response.status})`);
                } else {
                    console.error(`[FAIL] Route /api/${r} NOT FOUND (404)`);
                }
            }
        }

        // 4. Create Lead
        console.log('4. Creating Lead...');
        try {
            const leadRes = await axios.post(`${API_URL}/leads`, {
                name: 'API Test Lead',
                phone: '5550001111',
                email: 'api@chk.com',
                status: 'new'
            }, { headers });
            console.log(`[PASS] Lead Created (ID: ${leadRes.data.data.id})`);
        } catch (e) {
            console.error(`[FAIL] Lead Creation Error: ${e.message}`, e.response?.data);
        }

    } catch (error) {
        console.error('CRITICAL ERROR:', error.message);
    }
}

verify();
