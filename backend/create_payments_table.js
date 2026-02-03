const { query } = require('./config/database');

const createTable = async () => {
    try {
        const queryText = `
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        subscription_id UUID REFERENCES subscriptions(id),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'pending',
        payment_type VARCHAR(50), -- subscription, topup, etc.
        description TEXT,
        gateway VARCHAR(50), -- razorpay, stripe
        gateway_payment_id VARCHAR(255),
        gateway_order_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
        await query(queryText);
        console.log('Payments table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Failed to create payments table:', error);
        process.exit(1);
    }
};

createTable();
