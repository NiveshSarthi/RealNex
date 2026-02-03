const axios = require('axios');

async function testDup() {
    const url = 'http://localhost:5000/api/auth/register';
    const data = {
        name: 'Duplicate User',
        email: 'ratnakerkumar56@gmail.com', // This user already exists
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
    }
}

testDup();
