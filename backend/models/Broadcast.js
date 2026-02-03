const { query } = require('../config/database');

class Broadcast {
  constructor(data) {
    this.id = data.id;
    this.organizationId = data.organization_id;
    this.name = data.name;
    this.description = data.description;
    this.templateId = data.template_id;
    this.workflowId = data.workflow_id;
    this.audienceFilters = data.audience_filters;
    this.status = data.status || 'draft';
    this.scheduledAt = data.scheduled_at;
    this.sentCount = data.sent_count || 0;
    this.deliveredCount = data.delivered_count || 0;
    this.readCount = data.read_count || 0;
    this.failedCount = data.failed_count || 0;
    this.createdBy = data.created_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new broadcast
  static async create(broadcastData) {
    const {
      organizationId,
      name,
      description,
      templateId,
      workflowId,
      audienceFilters,
      status,
      scheduledAt,
      createdBy
    } = broadcastData;

    const queryText = `
      INSERT INTO broadcasts (
        organization_id, name, description, template_id, workflow_id,
        audience_filters, status, scheduled_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      organizationId, name, description, templateId, workflowId,
      JSON.stringify(audienceFilters), status, scheduledAt, createdBy
    ];

    try {
      const result = await query(queryText, values);
      return new Broadcast(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating broadcast: ${error.message}`);
    }
  }

  // Find broadcast by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM broadcasts WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Broadcast(result.rows[0]);
  }

  // Find broadcasts by organization
  static async findByOrganization(organizationId, status = null, limit = 50, offset = 0) {
    let queryText = 'SELECT * FROM broadcasts WHERE organization_id = $1';
    const values = [organizationId];

    if (status) {
      queryText += ' AND status = $2';
      values.push(status);
    }

    queryText += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new Broadcast(row));
  }

  // Update broadcast
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMap = {
      name: 'name',
      description: 'description',
      templateId: 'template_id',
      workflowId: 'workflow_id',
      audienceFilters: 'audience_filters',
      status: 'status',
      scheduledAt: 'scheduled_at',
      sent_count: 'sent_count',
      delivered_count: 'delivered_count',
      read_count: 'read_count',
      failed_count: 'failed_count'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMap[key]) {
        fields.push(`${fieldMap[key]} = $${paramCount}`);
        if (key === 'audienceFilters') {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id); // Add ID at the end

    const queryText = `
      UPDATE broadcasts
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Update status
  async updateStatus(status) {
    return this.update({ status });
  }

  // Update statistics
  async updateStats(sent = 0, delivered = 0, read = 0, failed = 0) {
    const updateData = {};
    if (sent > 0) updateData.sent_count = this.sentCount + sent;
    if (delivered > 0) updateData.delivered_count = this.deliveredCount + delivered;
    if (read > 0) updateData.read_count = this.readCount + read;
    if (failed > 0) updateData.failed_count = this.failedCount + failed;

    return this.update(updateData);
  }

  // Delete broadcast
  async delete() {
    const queryText = 'DELETE FROM broadcasts WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get broadcast recipients
  async getRecipients(limit = 1000, offset = 0) {
    const queryText = `
      SELECT br.*, c.first_name, c.last_name, c.phone as whatsapp_number, c.email
      FROM broadcast_recipients br
      JOIN contacts c ON br.contact_id = c.id
      WHERE br.broadcast_id = $1
      ORDER BY br.created_at
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryText, [this.id, limit, offset]);

    return result.rows.map(row => ({
      recipient: {
        id: row.contact_id,
        firstName: row.first_name,
        lastName: row.last_name,
        whatsappNumber: row.whatsapp_number,
        email: row.email
      },
      status: row.status,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      errorMessage: row.error_message
    }));
  }

  // Add recipients to broadcast
  async addRecipients(contactIds) {
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('Contact IDs array is required');
    }

    const values = contactIds.map(contactId => `($1, $${contactIds.indexOf(contactId) + 2})`).join(', ');
    const params = [this.id, ...contactIds];

    const queryText = `
      INSERT INTO broadcast_recipients (broadcast_id, contact_id)
      VALUES ${values}
      ON CONFLICT (broadcast_id, contact_id) DO NOTHING
    `;

    await query(queryText, params);
    return { success: true };
  }

  // Get audience size based on filters
  static async getAudienceSize(organizationId, filters) {
    let queryText = 'SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1';
    const values = [organizationId];
    let paramCount = 2;

    if (filters.tags && filters.tags.length > 0) {
      queryText += ` AND tags && $${paramCount}`;
      values.push(filters.tags);
      paramCount++;
    }

    if (filters.engagementScore) {
      queryText += ` AND engagement_score >= $${paramCount}`;
      values.push(filters.engagementScore);
      paramCount++;
    }

    if (filters.lastContactedDays) {
      const date = new Date();
      date.setDate(date.getDate() - filters.lastContactedDays);
      queryText += ` AND (last_contacted_at >= $${paramCount} OR last_contacted_at IS NULL)`;
      values.push(date);
      paramCount++;
    }

    if (filters.location) {
      queryText += ` AND custom_fields->>'city' = $${paramCount}`;
      values.push(filters.location);
      paramCount++;
    }

    const result = await query(queryText, values);
    return result.rows[0].count;
  }

  // Get broadcast statistics
  static async getStats(organizationId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_broadcasts,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_broadcasts,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_broadcasts,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_broadcasts,
        SUM(sent_count) as total_sent,
        SUM(delivered_count) as total_delivered,
        SUM(read_count) as total_read,
        SUM(failed_count) as total_failed,
        ROUND(
          CASE
            WHEN SUM(sent_count) > 0
            THEN (SUM(delivered_count)::decimal / SUM(sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as avg_delivery_rate,
        ROUND(
          CASE
            WHEN SUM(sent_count) > 0
            THEN (SUM(read_count)::decimal / SUM(sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as avg_read_rate
      FROM broadcasts
    `;

    const values = [];
    if (organizationId) {
      queryText += ' WHERE organization_id = $1';
      values.push(organizationId);
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }
}

module.exports = Broadcast;