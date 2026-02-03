const { query } = require('../config/database');

class QuickReply {
    constructor(data) {
        this.id = data.id;
        this.organizationId = data.organization_id;
        this.title = data.title;
        this.category = data.category;
        this.action = data.action;
        this.replyText = data.reply_text;
        this.displayOrder = data.display_order;
        this.isActive = data.is_active;
        this.createdAt = data.created_at;
    }

    static async create(data) {
        const { organizationId, title, category, action, replyText, displayOrder = 0 } = data;

        const queryText = `
      INSERT INTO quick_replies (organization_id, title, category, action, reply_text, display_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

        const values = [organizationId, title, category, action, replyText, displayOrder];
        const result = await query(queryText, values);
        return new QuickReply(result.rows[0]);
    }

    static async findAll(organizationId, filters = {}) {
        let queryText = 'SELECT * FROM quick_replies WHERE organization_id = $1';
        const values = [organizationId];
        let paramCount = 2;

        if (filters.category) {
            queryText += ` AND category = $${paramCount}`;
            values.push(filters.category);
            paramCount++;
        }

        queryText += ' ORDER BY display_order ASC, created_at DESC';

        const result = await query(queryText, values);
        return result.rows.map(row => new QuickReply(row));
    }

    static async findById(id) {
        const result = await query('SELECT * FROM quick_replies WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        return new QuickReply(result.rows[0]);
    }

    static async update(id, data) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        Object.keys(data).forEach(key => {
            if (data[key] !== undefined) {
                // Map camelCase to snake_case params
                const dbField = key === 'organizationId' ? 'organization_id' :
                    key === 'replyText' ? 'reply_text' :
                        key === 'displayOrder' ? 'display_order' :
                            key === 'isActive' ? 'is_active' : key;

                fields.push(`${dbField} = $${paramCount}`);
                values.push(data[key]);
                paramCount++;
            }
        });

        if (fields.length === 0) return null;

        values.push(id);
        const queryText = `UPDATE quick_replies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

        const result = await query(queryText, values);
        if (result.rows.length === 0) return null;
        return new QuickReply(result.rows[0]);
    }

    static async delete(id) {
        await query('DELETE FROM quick_replies WHERE id = $1', [id]);
        return true;
    }
}

module.exports = QuickReply;
