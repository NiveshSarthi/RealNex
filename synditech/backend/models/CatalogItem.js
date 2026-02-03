const { query } = require('../config/database');

class CatalogItem {
  constructor(data) {
    this.id = data.id;
    this.agentId = data.agent_id;
    this.retailerId = data.retailer_id;
    this.name = data.name;
    this.description = data.description;
    this.price = data.price;
    this.currency = data.currency || 'INR';
    this.imageUrl = data.image_url;
    this.propertyUrl = data.property_url;
    this.category = data.category;
    this.location = data.location;
    this.bhk = data.bhk;
    this.areaSqft = data.area_sqft;
    this.status = data.status || 'available';
    this.availability = data.availability || 'in stock';
    this.tags = data.tags || [];
    this.isActive = data.is_active !== false;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new catalog item
  static async create(catalogData) {
    const {
      agentId,
      retailerId,
      name,
      description,
      price,
      currency,
      imageUrl,
      propertyUrl,
      category,
      location,
      bhk,
      areaSqft,
      status,
      availability,
      tags
    } = catalogData;

    const queryText = `
      INSERT INTO catalog_items (
        agent_id, retailer_id, name, description, price, currency,
        image_url, property_url, category, location, bhk, area_sqft,
        status, availability, tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      agentId, retailerId, name, description, price, currency || 'INR',
      imageUrl, propertyUrl, category, location, bhk, areaSqft,
      status || 'available', availability || 'in stock', tags || []
    ];

    try {
      const result = await query(queryText, values);
      return new CatalogItem(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating catalog item: ${error.message}`);
    }
  }

  // Find catalog item by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM catalog_items WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new CatalogItem(result.rows[0]);
  }

  // Find catalog items by agent
  static async findByAgent(agentId, filters = {}, limit = 50, offset = 0) {
    let queryText = 'SELECT * FROM catalog_items WHERE agent_id = $1 AND is_active = true';
    const values = [agentId];
    let paramCount = 1;

    // Apply filters
    if (filters.category) {
      paramCount++;
      queryText += ` AND category = $${paramCount}`;
      values.push(filters.category);
    }

    if (filters.location) {
      paramCount++;
      queryText += ` AND location ILIKE $${paramCount}`;
      values.push(`%${filters.location}%`);
    }

    if (filters.bhk) {
      paramCount++;
      queryText += ` AND bhk = $${paramCount}`;
      values.push(filters.bhk);
    }

    if (filters.minPrice) {
      paramCount++;
      queryText += ` AND price >= $${paramCount}`;
      values.push(filters.minPrice);
    }

    if (filters.maxPrice) {
      paramCount++;
      queryText += ` AND price <= $${paramCount}`;
      values.push(filters.maxPrice);
    }

    if (filters.status) {
      paramCount++;
      queryText += ` AND status = $${paramCount}`;
      values.push(filters.status);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new CatalogItem(row));
  }

  // Smart property matching based on buyer requirements
  static async findMatchingProperties(agentId, requirements) {
    let queryText = 'SELECT * FROM catalog_items WHERE agent_id = $1 AND is_active = true';
    const values = [agentId];
    let paramCount = 1;

    // Parse natural language requirements
    const { bhk, location, budget, category, status } = requirements;

    if (bhk) {
      paramCount++;
      queryText += ` AND bhk = $${paramCount}`;
      values.push(bhk);
    }

    if (location) {
      paramCount++;
      queryText += ` AND location ILIKE $${paramCount}`;
      values.push(`%${location}%`);
    }

    if (budget) {
      // Convert budget from lakhs to actual price
      const maxPrice = budget * 100000; // Convert lakhs to rupees
      paramCount++;
      queryText += ` AND price <= $${paramCount}`;
      values.push(maxPrice);
    }

    if (category) {
      paramCount++;
      queryText += ` AND category = $${paramCount}`;
      values.push(category);
    }

    if (status) {
      paramCount++;
      queryText += ` AND status = $${paramCount}`;
      values.push(status);
    } else {
      // Default to available properties
      queryText += ` AND status = 'available'`;
    }

    queryText += ` ORDER BY price ASC LIMIT 5`; // Return top 5 matches

    const result = await query(queryText, values);
    return result.rows.map(row => new CatalogItem(row));
  }

  // Update catalog item
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
      UPDATE catalog_items
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Delete catalog item (soft delete)
  async delete() {
    return this.update({ isActive: false });
  }

  // Get catalog statistics for agent
  static async getStatsForAgent(agentId) {
    const queryText = `
      SELECT
        COUNT(*) as total_items,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_items,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_items,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(DISTINCT category) as categories_count,
        COUNT(DISTINCT location) as locations_count
      FROM catalog_items
      WHERE agent_id = $1 AND is_active = true
    `;

    const result = await query(queryText, [agentId]);
    return result.rows[0];
  }

  // Bulk import catalog items
  static async bulkImport(agentId, items) {
    const imported = [];
    const errors = [];

    for (const item of items) {
      try {
        const catalogItem = await this.create({
          agentId,
          ...item
        });
        imported.push(catalogItem);
      } catch (error) {
        errors.push({
          item,
          error: error.message
        });
      }
    }

    return { imported, errors };
  }

  // Sync with WhatsApp Business API
  async syncToWhatsApp() {
    const whatsappService = require('../services/whatsapp');

    const productData = {
      catalogId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      retailerId: this.retailerId,
      name: this.name,
      description: this.description,
      price: this.price,
      currency: this.currency,
      imageUrl: this.imageUrl,
      url: this.propertyUrl,
      category: this.category,
      availability: this.availability
    };

    return await whatsappService.createCatalogItem(productData);
  }
}

module.exports = CatalogItem;