const { query } = require('../config/database');

class Message {
  constructor(data) {
    this.id = data.id;
    this.conversationId = data.conversation_id;
    this.whatsappMessageId = data.whatsapp_message_id;
    this.direction = data.direction; // inbound, outbound
    this.messageType = data.message_type || 'text';
    this.content = data.content;
    this.mediaUrl = data.media_url;
    this.mediaCaption = data.media_caption;
    this.mediaFilename = data.media_filename;
    this.status = data.status || 'sent';
    this.sentAt = data.sent_at;
    this.deliveredAt = data.delivered_at;
    this.readAt = data.read_at;
    this.createdAt = data.created_at;
  }

  // Create a new message
  static async create(messageData) {
    const {
      conversationId,
      whatsappMessageId,
      direction,
      messageType,
      content,
      mediaUrl,
      mediaCaption,
      mediaFilename,
      status,
      sentAt
    } = messageData;

    const queryText = `
      INSERT INTO messages (
        conversation_id, whatsapp_message_id, direction, message_type,
        content, media_url, media_caption, media_filename, status, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      conversationId, whatsappMessageId, direction, messageType,
      content, mediaUrl, mediaCaption, mediaFilename, status, sentAt
    ];

    try {
      const result = await query(queryText, values);
      return new Message(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating message: ${error.message}`);
    }
  }

  // Find message by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM messages WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Message(result.rows[0]);
  }

  // Find messages by conversation
  static async findByConversation(conversationId, limit = 100, offset = 0) {
    const queryText = `
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryText, [conversationId, limit, offset]);

    return result.rows.map(row => new Message(row)).reverse(); // Reverse to show chronological order
  }

  // Find message by WhatsApp message ID
  static async findByWhatsAppId(whatsappMessageId) {
    const queryText = 'SELECT * FROM messages WHERE whatsapp_message_id = $1';
    const result = await query(queryText, [whatsappMessageId]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Message(result.rows[0]);
  }

  // Update message status
  async updateStatus(status, timestamp = null) {
    const updateData = { status };

    if (status === 'delivered' && !this.deliveredAt) {
      updateData.delivered_at = timestamp || new Date();
    } else if (status === 'read' && !this.readAt) {
      updateData.read_at = timestamp || new Date();
    }

    return this.update(updateData);
  }

  // Update message
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
      UPDATE messages
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Delete message
  async delete() {
    const queryText = 'DELETE FROM messages WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get message statistics
  static async getStats(conversationId = null, organizationId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_messages,
        COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_messages,
        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_messages,
        COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_messages,
        COUNT(CASE WHEN message_type IN ('image', 'video', 'audio', 'document') THEN 1 END) as media_messages,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_messages,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_messages,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read_messages,
        AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at))) as avg_delivery_time_seconds,
        AVG(EXTRACT(EPOCH FROM (read_at - sent_at))) as avg_read_time_seconds
      FROM messages m
    `;

    const values = [];
    let conditions = [];

    if (conversationId) {
      conditions.push('m.conversation_id = $1');
      values.push(conversationId);
    }

    if (organizationId) {
      queryText = `
        SELECT
          COUNT(*) as total_messages,
          COUNT(CASE WHEN m.direction = 'inbound' THEN 1 END) as inbound_messages,
          COUNT(CASE WHEN m.direction = 'outbound' THEN 1 END) as outbound_messages,
          COUNT(CASE WHEN m.message_type = 'text' THEN 1 END) as text_messages,
          COUNT(CASE WHEN m.message_type IN ('image', 'video', 'audio', 'document') THEN 1 END) as media_messages,
          COUNT(CASE WHEN m.status = 'sent' THEN 1 END) as sent_messages,
          COUNT(CASE WHEN m.status = 'delivered' THEN 1 END) as delivered_messages,
          COUNT(CASE WHEN m.status = 'read' THEN 1 END) as read_messages,
          AVG(EXTRACT(EPOCH FROM (m.delivered_at - m.sent_at))) as avg_delivery_time_seconds,
          AVG(EXTRACT(EPOCH FROM (m.read_at - m.sent_at))) as avg_read_time_seconds
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        JOIN whatsapp_accounts wa ON c.whatsapp_account_id = wa.id
      `;
      conditions.push('wa.organization_id = $1');
      values.push(organizationId);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Search messages
  static async search(searchTerm, conversationId = null, limit = 50, offset = 0) {
    let queryText = `
      SELECT m.*, c.whatsapp_conversation_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.content ILIKE $1
    `;
    const values = [`%${searchTerm}%`];

    if (conversationId) {
      queryText += ' AND m.conversation_id = $2';
      values.push(conversationId);
    }

    queryText += ' ORDER BY m.created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new Message(row));
  }
}

module.exports = Message;