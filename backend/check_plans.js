const { query } = require('./config/database');

const checkPlans = async () => {
    try {
        console.log('Checking subscription_plans table...');
        const res = await query('SELECT count(*) FROM subscription_plans');
        const count = parseInt(res.rows[0].count);
        console.log(`Found ${count} plans.`);

        if (count === 0) {
            console.log('Seeding default plans...');
            const plans = [
                {
                    name: 'Starter',
                    tier: 'starter',
                    price_monthly: 0,
                    price_yearly: 0,
                    features: JSON.stringify(['1,000 Conversations/mo', 'Basic Support', '1 Team Member', 'Standard Broadcasts']),
                    is_active: true
                },
                {
                    name: 'Pro',
                    tier: 'pro',
                    price_monthly: 2999,
                    price_yearly: 29990,
                    features: JSON.stringify(['10,000 Conversations/mo', 'Priority Support', '5 Team Members', 'Advanced Analytics', 'Flow Builder']),
                    is_active: true
                },
                {
                    name: 'Enterprise',
                    tier: 'enterprise',
                    price_monthly: 9999,
                    price_yearly: 99990,
                    features: JSON.stringify(['Unlimited Conversations', 'Dedicated Support', 'Unlimited Team Members', 'Custom Integrations', 'White Labeling']),
                    is_active: true
                }
            ];

            for (const plan of plans) {
                await query(
                    'INSERT INTO subscription_plans (name, tier, price_monthly, price_yearly, features, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
                    [plan.name, plan.tier, plan.price_monthly, plan.price_yearly, plan.features, plan.is_active]
                );
                console.log(`Inserted plan: ${plan.name}`);
            }
            console.log('Seeding complete.');
        } else {
            console.log('Plans already exist. No action needed.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
};

checkPlans();
