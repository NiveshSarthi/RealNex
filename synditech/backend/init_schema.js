const fs = require('fs');
const path = require('path');
const { query } = require('./config/database');

async function initSchema() {
  try {
    console.log('Initializing database schema...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Split the SQL into individual statements (basic approach)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await query(statement);
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (error) {
          // Skip errors for already existing objects
          if (!error.message.includes('already exists')) {
            console.log(`⚠️  Skipped: ${statement.substring(0, 50)}... (${error.message})`);
          }
        }
      }
    }

    console.log('Schema initialization completed!');
  } catch (error) {
    console.error('Schema initialization failed:', error);
    process.exit(1);
  }
}

initSchema().then(() => {
  console.log('Schema initialization script completed');
  process.exit(0);
});