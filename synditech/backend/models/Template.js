const { query } = require('../config/database');

class Template {
  constructor(data) {
    this.id = data.id;
    this.agentId = data.agent_id;
    this.name = data.name;
    this.category = data.category || 'general';
    this.content = data.content;
    this.variables = data.variables || {};
    this.language = data.language || 'en';
    this.isSystem = data.is_system || false;
    this.isApproved = data.is_approved !== false;
    this.usageCount = data.usage_count || 0;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new template
  static async create(templateData) {
    const {
      agentId,
      name,
      category,
      content,
      variables,
      language,
      isSystem,
      isApproved
    } = templateData;

    const queryText = `
      INSERT INTO templates (
        agent_id, name, category, content, variables,
        language, is_system, is_approved
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      agentId, name, category, content,
      JSON.stringify(variables || {}), language, isSystem || false, isApproved !== false
    ];

    try {
      const result = await query(queryText, values);
      return new Template(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating template: ${error.message}`);
    }
  }

  // Find template by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM templates WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Template(result.rows[0]);
  }

  // Find templates by agent
  static async findByAgent(agentId, category = null, limit = 50, offset = 0) {
    let queryText = 'SELECT * FROM templates WHERE (agent_id = $1 OR is_system = true)';
    const values = [agentId];

    if (category) {
      queryText += ' AND category = $2';
      values.push(category);
    }

    queryText += ' ORDER BY is_system DESC, usage_count DESC, created_at DESC';
    queryText += ' LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new Template(row));
  }

  // Find system templates
  static async findSystemTemplates(category = null, limit = 50) {
    let queryText = 'SELECT * FROM templates WHERE is_system = true';
    const values = [];

    if (category) {
      queryText += ' AND category = $1';
      values.push(category);
    }

    queryText += ' ORDER BY usage_count DESC, created_at DESC LIMIT $' + (values.length + 1);
    values.push(limit);

    const result = await query(queryText, values);
    return result.rows.map(row => new Template(row));
  }

  // Search templates
  static async search(searchTerm, agentId, limit = 50) {
    const queryText = `
      SELECT * FROM templates
      WHERE (agent_id = $1 OR is_system = true)
        AND (name ILIKE $2 OR content ILIKE $2 OR category ILIKE $2)
      ORDER BY is_system DESC, usage_count DESC
      LIMIT $3
    `;
    const result = await query(queryText, [agentId, `%${searchTerm}%`, limit]);

    return result.rows.map(row => new Template(row));
  }

  // Update template
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'variables') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updateData[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updateData[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id);

    const queryText = `
      UPDATE templates
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Increment usage count
  async incrementUsage() {
    return this.update({ usage_count: this.usageCount + 1 });
  }

  // Process template with variables
  processTemplate(variableValues = {}) {
    let processedContent = this.content;

    // Replace variables in content
    Object.keys(this.variables).forEach(varName => {
      const placeholder = `{{${varName}}}`;
      const value = variableValues[varName] || this.variables[varName] || '';
      processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
    });

    return processedContent;
  }

  // Get template statistics
  static async getStats(agentId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_templates,
        COUNT(CASE WHEN is_system = true THEN 1 END) as system_templates,
        COUNT(CASE WHEN is_system = false THEN 1 END) as custom_templates,
        COUNT(CASE WHEN category = 'greeting' THEN 1 END) as greeting_templates,
        COUNT(CASE WHEN category = 'follow_up' THEN 1 END) as follow_up_templates,
        COUNT(CASE WHEN category = 'property_info' THEN 1 END) as property_templates,
        COUNT(CASE WHEN category = 'closing' THEN 1 END) as closing_templates,
        SUM(usage_count) as total_usage
      FROM templates
    `;

    const values = [];
    if (agentId) {
      queryText += ' WHERE agent_id = $1 OR is_system = true';
      values.push(agentId);
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Get popular templates
  static async getPopular(agentId, limit = 10) {
    const queryText = `
      SELECT * FROM templates
      WHERE (agent_id = $1 OR is_system = true) AND usage_count > 0
      ORDER BY usage_count DESC
      LIMIT $2
    `;
    const result = await query(queryText, [agentId, limit]);

    return result.rows.map(row => new Template(row));
  }

  // Delete template
  async delete() {
    // Don't allow deletion of system templates
    if (this.isSystem) {
      throw new Error('Cannot delete system templates');
    }

    const queryText = 'DELETE FROM templates WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Validate template variables
  validateVariables(variableValues = {}) {
    const requiredVars = Object.keys(this.variables);
    const providedVars = Object.keys(variableValues);
    const missingVars = requiredVars.filter(v => !providedVars.includes(v));

    return {
      isValid: missingVars.length === 0,
      missingVariables: missingVars,
      providedVariables: providedVars
    };
  }

  // Get template preview
  getPreview(variableValues = {}) {
    const processed = this.processTemplate(variableValues);
    const validation = this.validateVariables(variableValues);

    return {
      id: this.id,
      name: this.name,
      category: this.category,
      language: this.language,
      processedContent: processed,
      characterCount: processed.length,
      validation: validation,
      variables: this.variables
    };
  }
}

module.exports = Template;