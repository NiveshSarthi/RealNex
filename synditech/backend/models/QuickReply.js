const { query } = require('../config/database');

class QuickReply {
  constructor(data) {
    this.id = data.id;
    this.organizationId = data.organization_id;
    this.title = data.title;
    this.action = data.action;
    this.category = data.category || 'general';
    this.isActive = data.is_active !== false;
    this.order = data.order || 0;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new quick reply
  static async create(replyData) {
    const {
      organizationId,
      title,
      action,
      category,
      order
    } = replyData;

    const queryText = `
      INSERT INTO quick_replies (
        organization_id, title, action, category, "order"
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [organizationId, title, action, category || 'general', order || 0];

    try {
      const result = await query(queryText, values);
      return new QuickReply(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating quick reply: ${error.message}`);
    }
  }

  // Find quick reply by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM quick_replies WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new QuickReply(result.rows[0]);
  }

  // Find quick replies by organization
  static async findByOrganization(organizationId, category = null, limit = 100) {
    let queryText = 'SELECT * FROM quick_replies WHERE organization_id = $1 AND is_active = true';
    const values = [organizationId];

    if (category) {
      queryText += ' AND category = $2';
      values.push(category);
    }

    queryText += ' ORDER BY "order" ASC, title ASC LIMIT $' + (values.length + 1);
    values.push(limit);

    const result = await query(queryText, values);
    return result.rows.map(row => new QuickReply(row));
  }

  // Update quick reply
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id);

    const queryText = `
      UPDATE quick_replies
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Delete quick reply (soft delete)
  async delete() {
    return this.update({ isActive: false });
  }

  // Bulk create quick replies
  static async bulkCreate(organizationId, replies) {
    const created = [];
    const errors = [];

    for (const reply of replies) {
      try {
        const quickReply = await this.create({
          organizationId,
          ...reply
        });
        created.push(quickReply);
      } catch (error) {
        errors.push({
          reply,
          error: error.message
        });
      }
    }

    return { created, errors };
  }

  // Get default quick replies for new organizations
  static getDefaultReplies() {
    return [
      {
        title: '🏠 Search Properties',
        action: 'property_search',
        category: 'navigation',
        order: 1
      },
      {
        title: '📅 Schedule Visit',
        action: 'schedule_visit',
        category: 'navigation',
        order: 2
      },
      {
        title: '💰 Calculate EMI',
        action: 'emi_calculator',
        category: 'tools',
        order: 3
      },
      {
        title: '📞 Talk to Agent',
        action: 'contact_agent',
        category: 'support',
        order: 4
      },
      {
        title: '📄 Required Documents',
        action: 'view_documents',
        category: 'information',
        order: 5
      },
      {
        title: '❓ FAQs',
        action: 'show_faqs',
        category: 'support',
        order: 6
      }
    ];
  }

  // Setup default quick replies for new organization
  static async setupDefaultsForOrganization(organizationId) {
    const defaults = this.getDefaultReplies();
    return this.bulkCreate(organizationId, defaults);
  }

  // Get quick reply statistics
  static async getStatsForOrganization(organizationId) {
    const queryText = `
      SELECT
        COUNT(*) as total_replies,
        COUNT(DISTINCT category) as categories_count
      FROM quick_replies
      WHERE organization_id = $1 AND is_active = true
    `;

    const result = await query(queryText, [organizationId]);
    return result.rows[0];
  }
}

module.exports = QuickReply;