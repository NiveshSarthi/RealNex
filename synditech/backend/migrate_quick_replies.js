const { query } = require('./config/database');

async function migrateQuickReplies() {
  try {
    console.log('Starting quick replies migration...');

    // First, create the agents table if it doesn't exist (simplified version)
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          business_name VARCHAR(255),
          location VARCHAR(255),
          experience_years INTEGER,
          specializations TEXT[],
          subscription_tier VARCHAR(50) DEFAULT 'starter',
          subscription_status VARCHAR(50) DEFAULT 'trial',
          subscription_start DATE,
          subscription_end DATE,
          is_active BOOLEAN DEFAULT true,
          aadhaar_verified BOOLEAN DEFAULT false,
          trust_score DECIMAL(3,2) DEFAULT 0.00,
          total_deals INTEGER DEFAULT 0,
          total_commission DECIMAL(15,2) DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('✅ Agents table created or already exists');
    } catch (error) {
      console.log('⚠️  Agents table creation skipped:', error.message);
    }

    // Drop existing quick_replies table
    await query('DROP TABLE IF EXISTS quick_replies CASCADE');
    console.log('✅ Old quick_replies table dropped');

    // Create new table with updated schema
    await query(`
      CREATE TABLE quick_replies (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES agents(id),
          title VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          category VARCHAR(50) DEFAULT 'general',
          "order" INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(organization_id, action)
      )
    `);
    console.log('✅ New quick_replies table created');

    // Create index
    await query('CREATE INDEX idx_quick_replies_organization ON quick_replies(organization_id)');
    console.log('✅ Index created');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateQuickReplies().then(() => {
  console.log('Migration script completed');
  process.exit(0);
});