const Property = require('../models/Property');
const BuyerProfile = require('../models/BuyerProfile');
const { query } = require('../config/database');

class MatchingService {
  // Auto-match properties to buyers
  async autoMatchAndNotify(organizationId, propertyId = null) {
    try {
      let properties;
      if (propertyId) {
        const property = await Property.findById(propertyId);
        properties = property ? [property] : [];
      } else {
        // Get recently added properties (last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        properties = await Property.findByOrganization(organizationId, {
          status: 'available',
          createdAfter: oneDayAgo
        });
      }

      const buyerProfiles = await BuyerProfile.findByOrganization(organizationId);
      const matches = [];

      for (const property of properties) {
        for (const buyerData of buyerProfiles) {
          const buyerProfile = buyerData.profile;
          const matchScore = buyerProfile.calculateMatchScore(property);

          if (matchScore >= 60) { // Configurable threshold
            matches.push({
              propertyId: property.id,
              buyerProfileId: buyerProfile.id,
              matchScore,
              matchReasons: this.generateMatchReasons(buyerProfile, property)
            });
          }
        }
      }

      // Save matches to database
      for (const match of matches) {
        await this.saveMatch(match);
      }

      // Send notifications (to be implemented)
      await this.sendMatchNotifications(matches);

      return {
        success: true,
        matchesCreated: matches.length,
        matches
      };
    } catch (error) {
      console.error('Auto matching error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save match to database
  async saveMatch(matchData) {
    const { propertyId, buyerProfileId, matchScore, matchReasons } = matchData;

    const queryText = `
      INSERT INTO property_matches (property_id, buyer_profile_id, match_score, match_reasons)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (property_id, buyer_profile_id)
      DO UPDATE SET match_score = $3, match_reasons = $4, created_at = NOW()
    `;

    await query(queryText, [propertyId, buyerProfileId, matchScore, JSON.stringify(matchReasons)]);
  }

  // Generate match reasons
  generateMatchReasons(buyerProfile, property) {
    const reasons = [];
    const preferences = buyerProfile.preferences;

    // Location match
    if (preferences.location && property.location) {
      const preferredAreas = preferences.location.areas || [];
      const propertyArea = property.location.area || property.location.city;

      if (preferredAreas.includes(propertyArea)) {
        reasons.push(`Perfect location match in ${propertyArea}`);
      }
    }

    // Budget match
    if (preferences.budget) {
      const { min, max } = preferences.budget;
      if (min <= property.price && property.price <= max) {
        reasons.push(`Price ₹${property.price.toLocaleString()} fits your budget`);
      }
    }

    // Specifications match
    if (preferences.specifications && property.specifications) {
      const prefSpecs = preferences.specifications;
      const propSpecs = property.specifications;

      if (prefSpecs.bedrooms && prefSpecs.bedrooms.includes(propSpecs.bedrooms)) {
        reasons.push(`${propSpecs.bedrooms} bedrooms match your preference`);
      }

      if (prefSpecs.bathrooms && prefSpecs.bathrooms.includes(propSpecs.bathrooms)) {
        reasons.push(`${propSpecs.bathrooms} bathrooms match your preference`);
      }

      if (prefSpecs.areaSqft && prefSpecs.areaSqft.min <= propSpecs.areaSqft && propSpecs.areaSqft <= prefSpecs.areaSqft.max) {
        reasons.push(`${propSpecs.areaSqft} sq.ft area is within your range`);
      }
    }

    // Amenities match
    if (preferences.amenities && property.amenities) {
      const matchedAmenities = preferences.amenities.filter(amenity =>
        property.amenities.includes(amenity)
      );

      if (matchedAmenities.length > 0) {
        reasons.push(`Amenities you want: ${matchedAmenities.join(', ')}`);
      }
    }

    return reasons;
  }

  // Send match notifications via WhatsApp
  async sendMatchNotifications(matches) {
    const whatsappService = require('./whatsapp');

    for (const match of matches) {
      try {
        // Get property and buyer details
        const property = await Property.findById(match.propertyId);
        const buyerProfile = await BuyerProfile.findById(match.buyerProfileId);

        if (!property || !buyerProfile) continue;

        // Get buyer contact info
        const buyerContact = await query(
          'SELECT whatsapp_number FROM contacts WHERE id = $1',
          [buyerProfile.buyerId]
        );

        if (buyerContact.rows.length === 0) continue;

        const whatsappNumber = buyerContact.rows[0].whatsapp_number;
        if (!whatsappNumber) continue;

        // Create personalized message
        const message = this.createMatchMessage(property, match);

        // Send WhatsApp message
        await whatsappService.sendTextMessage(whatsappNumber, message);

        // Update match as notified
        await query(
          'UPDATE property_matches SET notified = true, notified_at = NOW() WHERE property_id = $1 AND buyer_profile_id = $2',
          [match.propertyId, match.buyerProfileId]
        );

      } catch (error) {
        console.error('Error sending match notification:', error);
      }
    }
  }

  // Create match notification message
  createMatchMessage(property, match) {
    const matchScore = match.matchScore;
    const matchReasons = match.matchReasons.slice(0, 3); // Top 3 reasons

    let message = `🏠 *NEW PROPERTY MATCH (${matchScore}% match)*\n\n`;

    message += `*${property.title}*\n`;
    message += `📍 ${property.location.address || `${property.location.area}, ${property.location.city}`}\n`;
    message += `💰 ₹${property.price.toLocaleString()}\n`;
    message += `🏢 ${property.type} | ${property.specifications.bedrooms}BHK | ${property.specifications.areaSqft} sq.ft\n\n`;

    message += `*Why this matches you:*\n`;
    matchReasons.forEach(reason => {
      message += `✅ ${reason}\n`;
    });

    message += `\n🎯 *High match score!* Interested in viewing this property?\n\n`;
    message += `📞 Reply "YES" to schedule a visit\n`;
    message += `📋 Reply "DETAILS" for more information\n`;
    message += `❌ Reply "NO" to stop these recommendations`;

    return message;
  }

  // Get property recommendations for a buyer
  async getPropertyRecommendations(buyerProfileId, limit = 10) {
    const buyerProfile = await BuyerProfile.findById(buyerProfileId);
    if (!buyerProfile) {
      return [];
    }

    // Get all available properties
    const properties = await Property.findByOrganization(buyerProfile.organizationId, {
      status: 'available'
    }, 1000); // Get more properties for better matching

    // Calculate match scores
    const matches = properties.map(property => ({
      property,
      matchScore: buyerProfile.calculateMatchScore(property),
      matchReasons: this.generateMatchReasons(buyerProfile, property)
    }));

    // Filter and sort by match score
    const highMatches = matches
      .filter(match => match.matchScore >= 70)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return highMatches;
  }

  // Manual property search based on buyer preferences
  async searchProperties(buyerProfileId, searchCriteria = {}) {
    const buyerProfile = await BuyerProfile.findById(buyerProfileId);
    if (!buyerProfile) {
      return [];
    }

    const filters = {
      status: 'available',
      ...searchCriteria
    };

    // Apply buyer preferences as defaults
    const preferences = buyerProfile.preferences;
    if (preferences.location && !filters.location) {
      filters.location = preferences.location.city;
    }

    if (preferences.budget && !filters.minPrice && !filters.maxPrice) {
      filters.minPrice = preferences.budget.min;
      filters.maxPrice = preferences.budget.max;
    }

    if (preferences.specifications && !filters.type) {
      // Could add more specific filters here
    }

    const properties = await Property.findByOrganization(
      buyerProfile.organizationId,
      filters,
      50
    );

    // Calculate match scores for results
    return properties.map(property => ({
      property,
      matchScore: buyerProfile.calculateMatchScore(property),
      matchReasons: this.generateMatchReasons(buyerProfile, property)
    }));
  }

  // Get matching statistics
  async getMatchingStats(organizationId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_matches,
        AVG(match_score) as avg_match_score,
        COUNT(CASE WHEN match_score >= 90 THEN 1 END) as excellent_matches,
        COUNT(CASE WHEN match_score >= 80 AND match_score < 90 THEN 1 END) as good_matches,
        COUNT(CASE WHEN match_score >= 70 AND match_score < 80 THEN 1 END) as fair_matches,
        COUNT(CASE WHEN notified = true THEN 1 END) as notified_matches,
        AVG(EXTRACT(EPOCH FROM (notified_at - created_at))/3600) as avg_notification_time_hours
      FROM property_matches
    `;

    const values = [];
    if (organizationId) {
      queryText += ' WHERE property_id IN (SELECT id FROM properties WHERE organization_id = $1)';
      values.push(organizationId);
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Bulk match all buyers with all properties (for admin)
  async bulkMatch(organizationId) {
    const startTime = Date.now();

    // Clear old matches (optional, for fresh matching)
    await query('DELETE FROM property_matches WHERE created_at < NOW() - INTERVAL \'30 days\'');

    const result = await this.autoMatchAndNotify(organizationId);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    return {
      ...result,
      duration,
      matchesPerSecond: result.matchesCreated / duration
    };
  }
}

module.exports = new MatchingService();