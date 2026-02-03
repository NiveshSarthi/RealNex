const { query } = require('../config/database');

class Contact {
    constructor(data) {
        this.id = data.id;
        this.organizationId = data.organization_id;
        this.contactId = data.contact_id;
        this.channel = data.channel;
        this.phone = data.phone;
        this.whatsappNumber = data.whatsapp_number || data.phone; // Fallback to phone if whatsapp_number is missing
        this.email = data.email;
        this.firstName = data.first_name;
        this.lastName = data.last_name;
        this.customFields = data.custom_fields || {};
        this.tags = data.tags || [];
        this.engagementScore = data.engagement_score || 0;
        this.lastContactedAt = data.last_contacted_at;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    // Create a new contact
    static async create(contactData) {
        const {
            organizationId,
            contactId,
            channel,
            phone,
            email,
            firstName,
            lastName,
            customFields,
            tags
        } = contactData;

        // Build query dynamically based on provided fields
        const fields = [
            'organization_id', 'contact_id', 'channel', 'phone', 'email',
            'first_name', 'last_name', 'custom_fields', 'tags',
            'created_at', 'updated_at'
        ];
        const values = [
            organizationId,
            contactId,
            channel,
            phone,
            email,
            firstName,
            lastName,
            customFields,
            tags
        ];

        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const queryText = `
      INSERT INTO contacts (${fields.join(', ')})
      VALUES (${placeholders}, NOW(), NOW())
      RETURNING *
    `;

        try {
            const result = await query(queryText, values);
            return new Contact(result.rows[0]);
        } catch (error) {
            throw new Error(`Error creating contact: ${error.message}`);
        }
    }

    // Find contact by ID
    static async findById(id) {
        const queryText = 'SELECT * FROM contacts WHERE id = $1';
        const result = await query(queryText, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        return new Contact(result.rows[0]);
    }

    // Find by phone
    static async findByPhone(organizationId, phone) {
        const queryText = 'SELECT * FROM contacts WHERE organization_id = $1 AND phone = $2';
        const result = await query(queryText, [organizationId, phone]);

        if (result.rows.length === 0) {
            return null;
        }

        return new Contact(result.rows[0]);
    }

    // Find all by organization
    static async findByOrganization(organizationId, limit = 50, offset = 0) {
        const queryText = `
      SELECT * FROM contacts 
      WHERE organization_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
        const result = await query(queryText, [organizationId, limit, offset]);
        return result.rows.map(row => new Contact(row));
    }

    // Update contact
    async update(updateData) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        const fieldMap = {
            phone: 'phone',
            email: 'email',
            firstName: 'first_name',
            lastName: 'last_name',
            customFields: 'custom_fields',
            tags: 'tags',
            engagementScore: 'engagement_score',
            lastContactedAt: 'last_contacted_at'
        };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && fieldMap[key]) {
                fields.push(`${fieldMap[key]} = $${paramCount}`);
                if (key === 'customFields') {
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
      UPDATE contacts
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

        const result = await query(queryText, values);
        Object.assign(this, result.rows[0]);
        return this;
    }
}

module.exports = Contact;
