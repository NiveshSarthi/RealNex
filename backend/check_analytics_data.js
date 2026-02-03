const { query } = require('./config/database');

async function checkData() {
    try {
        console.log('Checking database counts...');

        // Check organizations
        // const orgs = await query('SELECT * FROM organizations LIMIT 1'); 
        // console.log('Organizations:', orgs.rows.length);

        // Check users
        // const users = await query('SELECT * FROM users LIMIT 1');
        // console.log('Users:', users.rows.length);
        // if (users.rows.length > 0) {
        //     console.log('Sample User:', users.rows[0]);
        // }

        const contacts = await query('SELECT count(*) FROM contacts');
        console.log('Contacts Count:', contacts.rows[0].count);

        const conversations = await query('SELECT count(*) FROM conversations');
        console.log('Conversations Count:', conversations.rows[0].count);

        const messages = await query('SELECT count(*) FROM messages');
        console.log('Messages Count:', messages.rows[0].count);

        const broadcasts = await query('SELECT count(*) FROM broadcasts');
        console.log('Broadcasts Count:', broadcasts.rows[0].count);

        process.exit(0);
    } catch (error) {
        console.error('Error checking data:', error);
        process.exit(1);
    }
}

checkData();
