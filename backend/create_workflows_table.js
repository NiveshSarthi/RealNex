const { query } = require('./config/database');

async function createWorkflowsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        organization_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        n8n_workflow_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'draft',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await query(createTableQuery);
    console.log("Table 'workflows' created successfully or already exists.");

    const createExecutionsTableQuery = `
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id SERIAL PRIMARY KEY,
        workflow_id VARCHAR(255), -- Storing n8n ID or our ID? Route uses n8n ID for execution logging usually
        execution_id VARCHAR(255),
        status VARCHAR(50),
        input_data JSONB,
        output_data JSONB,
        triggered_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `;

    await query(createExecutionsTableQuery);
    console.log("Table 'workflow_executions' created successfully or already exists.");

  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    process.exit();
  }
}

createWorkflowsTable();
