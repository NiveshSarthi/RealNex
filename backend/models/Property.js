const { query } = require('../config/database');

class Property {
  constructor(data) {
    this.id = data.id;
    this.organizationId = data.organization_id;
    this.propertyId = data.property_id;
    this.sellerId = data.seller_id;
    this.type = data.type;
    this.status = data.status || 'available';
    this.title = data.title;
    this.description = data.description;
    this.location = data.location;
    this.price = data.price;
    this.currency = data.currency || 'INR';
    this.specifications = data.specifications;
    this.amenities = data.amenities || [];
    this.images = data.images || [];
    this.virtualTourUrl = data.virtual_tour_url;
    this.documents = data.documents || [];
    this.tags = data.tags || [];
    this.featured = data.featured || false;
    this.createdBy = data.created_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new property
  static async create(propertyData) {
    const {
      organizationId,
      propertyId,
      sellerId,
      type,
      status,
      title,
      description,
      location,
      price,
      currency,
      specifications,
      amenities,
      images,
      virtualTourUrl,
      documents,
      tags,
      featured,
      createdBy
    } = propertyData;

    const queryText = `
      INSERT INTO properties (
        organization_id, property_id, seller_id, type, status, title,
        description, location, price, currency, specifications,
        amenities, images, virtual_tour_url, documents, tags, featured, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    const values = [
      organizationId, propertyId, sellerId, type, status, title,
      description, JSON.stringify(location), price, currency, JSON.stringify(specifications),
      amenities, images, virtualTourUrl, documents, tags, featured, createdBy
    ];

    try {
      const result = await query(queryText, values);
      return new Property(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating property: ${error.message}`);
    }
  }

  // Find property by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM properties WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Property(result.rows[0]);
  }

  // Find property by property ID
  static async findByPropertyId(propertyId) {
    const queryText = 'SELECT * FROM properties WHERE property_id = $1';
    const result = await query(queryText, [propertyId]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Property(result.rows[0]);
  }

  // Find properties by organization
  static async findByOrganization(organizationId, filters = {}, limit = 50, offset = 0) {
    let queryText = 'SELECT * FROM properties WHERE organization_id = $1';
    const values = [organizationId];
    let paramCount = 2;

    if (filters.status) {
      queryText += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.type) {
      queryText += ` AND type = $${paramCount}`;
      values.push(filters.type);
      paramCount++;
    }

    if (filters.minPrice) {
      queryText += ` AND price >= $${paramCount}`;
      values.push(filters.minPrice);
      paramCount++;
    }

    if (filters.maxPrice) {
      queryText += ` AND price <= $${paramCount}`;
      values.push(filters.maxPrice);
      paramCount++;
    }

    if (filters.location) {
      queryText += ` AND location->>'city' = $${paramCount}`;
      values.push(filters.location);
      paramCount++;
    }

    if (filters.featured !== undefined) {
      queryText += ` AND featured = $${paramCount}`;
      values.push(filters.featured);
      paramCount++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new Property(row));
  }

  // Search properties
  static async search(searchTerm, organizationId, limit = 50, offset = 0) {
    const queryText = `
      SELECT * FROM properties
      WHERE organization_id = $1
        AND (title ILIKE $2 OR description ILIKE $2 OR location->>'city' ILIKE $2)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await query(queryText, [organizationId, `%${searchTerm}%`, limit, offset]);

    return result.rows.map(row => new Property(row));
  }

  // Update property
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (['location', 'specifications'].includes(key)) {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updateData[key]));
        } else if (Array.isArray(updateData[key])) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updateData[key]);
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

    values.push(this.id); // Add ID at the end

    const queryText = `
      UPDATE properties
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

  // Add images
  async addImages(newImages) {
    const updatedImages = [...this.images, ...newImages];
    return this.update({ images: updatedImages });
  }

  // Remove image
  async removeImage(imageUrl) {
    const updatedImages = this.images.filter(img => img !== imageUrl);
    return this.update({ images: updatedImages });
  }

  // Add documents
  async addDocuments(newDocuments) {
    const updatedDocuments = [...this.documents, ...newDocuments];
    return this.update({ documents: updatedDocuments });
  }

  // Delete property
  async delete() {
    const queryText = 'DELETE FROM properties WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get property statistics
  static async getStats(organizationId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_properties,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_properties,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_properties,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_properties,
        COUNT(CASE WHEN featured = true THEN 1 END) as featured_properties,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(CASE WHEN type = 'apartment' THEN 1 END) as apartments,
        COUNT(CASE WHEN type = 'villa' THEN 1 END) as villas,
        COUNT(CASE WHEN type = 'plot' THEN 1 END) as plots
      FROM properties
    `;

    const values = [];
    if (organizationId) {
      queryText += ' WHERE organization_id = $1';
      values.push(organizationId);
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Get property matches for a buyer
  async getMatches(limit = 10) {
    const queryText = `
      SELECT pm.*, bp.preferences
      FROM property_matches pm
      JOIN buyer_profiles bp ON pm.buyer_profile_id = bp.id
      WHERE pm.property_id = $1
      ORDER BY pm.match_score DESC
      LIMIT $2
    `;
    const result = await query(queryText, [this.id, limit]);

    return result.rows;
  }

  // Get inquiries for this property
  async getInquiries(limit = 50, offset = 0) {
    const queryText = `
      SELECT c.*, ct.first_name, ct.last_name, ct.whatsapp_number, ct.email,
             m.content as last_message, m.created_at as last_message_at
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN (
        SELECT conversation_id, content, created_at
        FROM messages
        WHERE (conversation_id, created_at) IN (
          SELECT conversation_id, MAX(created_at)
          FROM messages
          GROUP BY conversation_id
        )
      ) m ON c.id = m.conversation_id
      WHERE c.id IN (
        SELECT conversation_id FROM messages
        WHERE content ILIKE $1
      )
      ORDER BY c.last_message_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryText, [`%${this.title}%`, limit, offset]);

    return result.rows;
  }
}

module.exports = Property;