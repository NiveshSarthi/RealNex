const { query } = require('../config/database');

class Template {
    constructor(data) {
        this.id = data.id;
        this.organizationId = data.organization_id;
        this.name = data.name;
        this.type = data.type;
        this.category = data.category;
        this.content = data.content;
        this.variables = data.variables || {};
        this.language = data.language || 'en';
        this.isGlobal = data.is_global;
        this.isApproved = data.is_approved;
        this.approvedBy = data.approved_by;
        this.approvedAt = data.approved_at;
        this.createdBy = data.created_by;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    // Create a new template
    static async create(templateData) {
        const {
            organizationId,
            name,
            type,
            category,
            content,
            variables,
            language,
            isGlobal,
            createdBy
        } = templateData;

        const queryText = `
      INSERT INTO templates (
        organization_id, name, type, category, content, variables,
        language, is_global, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;
        const values = [
            organizationId,
            name,
            type,
            category,
            JSON.stringify(content),
            JSON.stringify(variables),
            language,
            isGlobal,
            createdBy
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

    // Find templates by organization
    static async findByOrganization(organizationId, type = null, category = null) {
        let queryText = `
      SELECT * FROM templates
      WHERE (organization_id = $1 OR is_global = true)
    `;
        const values = [organizationId];

        if (type) {
            queryText += ' AND type = $2';
            values.push(type);
        }

        if (category) {
            queryText += ` AND category = $${values.length + 1}`;
            values.push(category);
        }

        queryText += ' ORDER BY created_at DESC';

        const result = await query(queryText, values);
        return result.rows.map(row => new Template(row));
    }

    // Update template
    async update(updateData) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        const fieldMap = {
            name: 'name',
            type: 'type',
            category: 'category',
            content: 'content',
            variables: 'variables',
            language: 'language',
            isGlobal: 'is_global',
            isApproved: 'is_approved'
        };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && fieldMap[key]) {
                fields.push(`${fieldMap[key]} = $${paramCount}`);
                if (key === 'content' || key === 'variables') {
                    values.push(JSON.stringify(updateData[key]));
                } else {
                    values.push(updateData[key]);
                }
                paramCount++;
            }
        });

        if (fields.length === 0) {
            return this;
        }

        values.push(this.id); // Add ID at the end

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

    // Delete template
    async delete() {
        const queryText = 'DELETE FROM templates WHERE id = $1';
        await query(queryText, [this.id]);
    }
}

module.exports = Template;
