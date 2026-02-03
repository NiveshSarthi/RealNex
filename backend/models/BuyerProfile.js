const { query } = require('../config/database');

class BuyerProfile {
  constructor(data) {
    this.id = data.id;
    this.organizationId = data.organization_id;
    this.buyerId = data.buyer_id;
    this.preferences = data.preferences;
    this.engagementScore = data.engagement_score || 0;
    this.lastActive = data.last_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new buyer profile
  static async create(buyerData) {
    const {
      organizationId,
      buyerId,
      preferences,
      engagementScore
    } = buyerData;

    const queryText = `
      INSERT INTO buyer_profiles (organization_id, buyer_id, preferences, engagement_score)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [organizationId, buyerId, JSON.stringify(preferences), engagementScore || 0];

    try {
      const result = await query(queryText, values);
      return new BuyerProfile(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating buyer profile: ${error.message}`);
    }
  }

  // Find buyer profile by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM buyer_profiles WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new BuyerProfile(result.rows[0]);
  }

  // Find buyer profile by buyer ID
  static async findByBuyerId(buyerId) {
    const queryText = 'SELECT * FROM buyer_profiles WHERE buyer_id = $1';
    const result = await query(queryText, [buyerId]);

    if (result.rows.length === 0) {
      return null;
    }

    return new BuyerProfile(result.rows[0]);
  }

  // Find buyer profiles by organization
  static async findByOrganization(organizationId, limit = 50, offset = 0) {
    const queryText = `
      SELECT bp.*, c.first_name, c.last_name, c.whatsapp_number, c.email
      FROM buyer_profiles bp
      LEFT JOIN contacts c ON bp.buyer_id = c.id
      WHERE bp.organization_id = $1
      ORDER BY bp.last_active DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryText, [organizationId, limit, offset]);

    return result.rows.map(row => ({
      profile: new BuyerProfile(row),
      contact: {
        id: row.buyer_id,
        firstName: row.first_name,
        lastName: row.last_name,
        whatsappNumber: row.whatsapp_number,
        email: row.email
      }
    }));
  }

  // Update buyer profile
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'preferences') {
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

    values.push(this.id); // Add ID at the end

    const queryText = `
      UPDATE buyer_profiles
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Update engagement score
  async updateEngagementScore(score) {
    return this.update({ engagement_score: score, last_active: new Date() });
  }

  // Update preferences
  async updatePreferences(preferences) {
    return this.update({ preferences, last_active: new Date() });
  }

  // Delete buyer profile
  async delete() {
    const queryText = 'DELETE FROM buyer_profiles WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get property recommendations for this buyer
  async getPropertyRecommendations(limit = 20) {
    const queryText = `
      SELECT p.*, pm.match_score, pm.match_reasons
      FROM properties p
      JOIN property_matches pm ON p.id = pm.property_id
      WHERE pm.buyer_profile_id = $1
        AND p.status = 'available'
      ORDER BY pm.match_score DESC
      LIMIT $2
    `;
    const result = await query(queryText, [this.id, limit]);

    return result.rows;
  }

  // Calculate match score with a property
  calculateMatchScore(property) {
    let score = 0;
    const maxScore = 100;
    const preferences = this.preferences;

    // Location match (30 points)
    if (preferences.location && property.location) {
      const preferredAreas = preferences.location.areas || [];
      const propertyArea = property.location.area || property.location.city;

      if (preferredAreas.includes(propertyArea)) {
        score += 30;
      } else if (preferences.location.radiusKm &&
                 this.calculateDistance(preferences.location, property.location) <= preferences.location.radiusKm) {
        score += 20;
      }
    }

    // Budget match (25 points)
    if (preferences.budget) {
      const { min, max } = preferences.budget;
      if (min <= property.price && property.price <= max) {
        score += 25;
      } else if (Math.abs(property.price - max) / max < 0.1) { // Within 10%
        score += 15;
      }
    }

    // Specifications match (25 points)
    if (preferences.specifications && property.specifications) {
      const prefSpecs = preferences.specifications;
      const propSpecs = property.specifications;

      // Bedrooms
      if (prefSpecs.bedrooms && prefSpecs.bedrooms.includes(propSpecs.bedrooms)) {
        score += 8;
      }

      // Bathrooms
      if (prefSpecs.bathrooms && prefSpecs.bathrooms.includes(propSpecs.bathrooms)) {
        score += 4;
      }

      // Area
      if (prefSpecs.areaSqft && prefSpecs.areaSqft.min <= propSpecs.areaSqft && propSpecs.areaSqft <= prefSpecs.areaSqft.max) {
        score += 8;
      }

      // Floor (for apartments)
      if (prefSpecs.floor && propSpecs.floor && prefSpecs.floor.includes(propSpecs.floor)) {
        score += 5;
      }
    }

    // Amenities match (20 points)
    if (preferences.amenities && property.amenities) {
      const matchedAmenities = preferences.amenities.filter(amenity =>
        property.amenities.includes(amenity)
      );
      const amenityScore = (matchedAmenities.length / preferences.amenities.length) * 20;
      score += amenityScore;
    }

    return Math.min(Math.round((score / maxScore) * 100), 100);
  }

  // Calculate distance between two locations (simplified)
  calculateDistance(loc1, loc2) {
    // Simplified distance calculation
    // In production, use proper geolocation distance calculation
    if (loc1.city === loc2.city) {
      return 0;
    }
    return 10; // Default 10km for different cities
  }

  // Get buyer profile statistics
  static async getStats(organizationId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_buyers,
        AVG(engagement_score) as avg_engagement_score,
        COUNT(CASE WHEN engagement_score >= 80 THEN 1 END) as high_engagement_buyers,
        COUNT(CASE WHEN engagement_score >= 50 AND engagement_score < 80 THEN 1 END) as medium_engagement_buyers,
        COUNT(CASE WHEN engagement_score < 50 THEN 1 END) as low_engagement_buyers,
        AVG(EXTRACT(EPOCH FROM (NOW() - last_active))/86400) as avg_days_since_active
      FROM buyer_profiles
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

module.exports = BuyerProfile;