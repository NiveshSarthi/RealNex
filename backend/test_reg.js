const axios = require('axios');

async function testRegistration() {
    const url = 'http://localhost:5000/api/auth/register';
    const data = {
        name: 'Test User',
        email: 'test' + Date.now() + '@example.com',
        businessName: 'Test Business',
        whatsappNumber: '1234567890',
        password: 'password123'
    };

    try {
        const response = await axios.post(url, data);
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('Error Status:', error.response?.status);
        console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
        if (!error.response) {
            console.log('Error Message:', error.message);
        }
    }
}

testRegistration();
