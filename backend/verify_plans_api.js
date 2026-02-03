const axios = require('axios');

async function checkApi() {
    try {
        console.log('Fetching plans from API...');
        const res = await axios.get('http://localhost:5000/api/subscriptions/plans');
        console.log('Status:', res.status);
        console.log('Data:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('API Error:', e.message);
        if (e.response) {
            console.log('Response:', e.response.data);
        }
    }
}

checkApi();
