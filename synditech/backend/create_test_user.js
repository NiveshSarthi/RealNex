const { query } = require('./config/database');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    console.log('Creating test user...');

    // Test user data - matching what the user wants
    const whatsappNumber = '+919876543210'; // Dummy WhatsApp number
    const name = 'Ratnakar Kumar';
    const email = 'ratnakerkumar56@gmail.com';
    const businessName = 'Test Real Estate';
    const location = 'Mumbai';
    const password = 'admin123'; // The password the user wants

    // Hash the password (not WhatsApp number)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists by email
    const existingUser = await query('SELECT id FROM agents WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      console.log('Test user already exists!');
      console.log('Email:', email);
      console.log('Password:', password);
      return;
    }

    // Create the user
    const result = await query(`
      INSERT INTO agents (
        whatsapp_number, name, email, business_name, location,
        subscription_tier, subscription_status, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, whatsapp_number, name, email
    `, [
      whatsappNumber,
      name,
      email,
      businessName,
      location,
      'professional', // Give them professional tier for testing
      'active',
      true
    ]);

    console.log('✅ Test user created successfully!');
    console.log('Login credentials:');
    console.log('- Email:', email);
    console.log('- Password:', password);
    console.log('- Name:', name);

    // Also create default quick replies for this user
    const { QuickReply } = require('./models/QuickReply');
    await QuickReply.setupDefaultsForOrganization(result.rows[0].id);
    console.log('✅ Default quick replies created for test user');

  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser().then(() => {
  console.log('Test user creation script completed');
  process.exit(0);
});