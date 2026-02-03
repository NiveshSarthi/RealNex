const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

const initDb = async () => {
    try {
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema migration...');
        await pool.query(schema);
        console.log('Database initialized successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
};

initDb();
