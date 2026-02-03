const { query } = require('../config/database');

class Conversation {
  constructor(data) {
    this.id = data.id;
    this.whatsappAccountId = data.whatsapp_account_id;
    this.whatsappConversationId = data.whatsapp_conversation_id;
    this.contactId = data.contact_id;
    this.assignedTo = data.assigned_to;
    this.status = data.status || 'open';
    this.priority = data.priority || 'normal';
    this.channel = data.channel || 'whatsapp';
    this.lastMessageAt = data.last_message_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new conversation
  static async create(conversationData) {
    const { whatsappAccountId, whatsappConversationId, contactId, assignedTo, status, priority, channel } = conversationData;

    const queryText = `
      INSERT INTO conversations (whatsapp_account_id, whatsapp_conversation_id, contact_id, assigned_to, status, priority, channel)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [whatsappAccountId, whatsappConversationId, contactId, assignedTo, status, priority, channel];

    try {
      const result = await query(queryText, values);
      return new Conversation(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating conversation: ${error.message}`);
    }
  }

  // Find conversation by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM conversations WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Conversation(result.rows[0]);
  }

  // Find conversation by WhatsApp conversation ID
  static async findByWhatsAppId(whatsappConversationId) {
    const queryText = 'SELECT * FROM conversations WHERE whatsapp_conversation_id = $1';
    const result = await query(queryText, [whatsappConversationId]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Conversation(result.rows[0]);
  }

  // Find conversations by contact
  static async findByContact(contactId, limit = 50, offset = 0) {
    const queryText = `
      SELECT * FROM conversations
      WHERE contact_id = $1
      ORDER BY last_message_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryText, [contactId, limit, offset]);

    return result.rows.map(row => new Conversation(row));
  }

  // Find conversations by assignee
  static async findByAssignee(assignedTo, status = null, limit = 50, offset = 0) {
    let queryText = `
      SELECT c.*, ct.first_name, ct.last_name, ct.whatsapp_number
      FROM conversations c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.assigned_to = $1
    `;
    const values = [assignedTo];

    if (status) {
      queryText += ' AND c.status = $2';
      values.push(status);
    }

    queryText += ' ORDER BY c.last_message_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => ({
      conversation: new Conversation(row),
      contact: {
        id: row.contact_id,
        firstName: row.first_name,
        lastName: row.last_name,
        whatsappNumber: row.whatsapp_number
      }
    }));
  }

  // Get all conversations with filters
  static async findAll(filters = {}, limit = 50, offset = 0) {
    let queryText = `
      SELECT c.*, ct.first_name, ct.last_name, ct.whatsapp_number
      FROM conversations c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    if (filters.status) {
      queryText += ` AND c.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.assignedTo) {
      queryText += ` AND c.assigned_to = $${paramCount}`;
      values.push(filters.assignedTo);
      paramCount++;
    }

    if (filters.contactId) {
      queryText += ` AND c.contact_id = $${paramCount}`;
      values.push(filters.contactId);
      paramCount++;
    }

    if (filters.priority) {
      queryText += ` AND c.priority = $${paramCount}`;
      values.push(filters.priority);
      paramCount++;
    }

    if (filters.channel) {
      queryText += ` AND c.channel = $${paramCount}`;
      values.push(filters.channel);
      paramCount++;
    }

    queryText += ` ORDER BY c.last_message_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => ({
      conversation: new Conversation(row),
      contact: {
        id: row.contact_id,
        firstName: row.first_name,
        lastName: row.last_name,
        whatsappNumber: row.whatsapp_number
      }
    }));
  }

  // Update conversation
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id); // Add ID at the end

    const queryText = `
      UPDATE conversations
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Assign conversation to user
  async assignTo(userId) {
    return this.update({ assigned_to: userId });
  }

  // Update status
  async updateStatus(status) {
    return this.update({ status, last_message_at: new Date() });
  }

  // Update priority
  async updatePriority(priority) {
    return this.update({ priority });
  }

  // Delete conversation
  async delete() {
    const queryText = 'DELETE FROM conversations WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get conversation statistics
  static async getStats(organizationId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_conversations,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_conversations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_conversations,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_priority,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_conversation_age_hours
      FROM conversations
    `;

    const values = [];
    if (organizationId) {
      queryText += ' WHERE whatsapp_account_id IN (SELECT id FROM whatsapp_accounts WHERE organization_id = $1)';
      values.push(organizationId);
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }
}

module.exports = Conversation;