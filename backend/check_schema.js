const { query } = require('./config/database');
const fs = require('fs');

const checkSchema = async () => {
  try {
    const res = await query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions';
    `);
    fs.writeFileSync('schema_dump.json', JSON.stringify(res.rows, null, 2));
    console.log('Schema written to schema_dump.json');
    process.exit(0);
  } catch (err) {
    console.error('Error querying schema:', err);
    process.exit(1);
  }
};

checkSchema();
