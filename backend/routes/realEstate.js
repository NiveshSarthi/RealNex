const express = require('express');
const Property = require('../models/Property');
const BuyerProfile = require('../models/BuyerProfile');
const matchingService = require('../services/matching');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/real-estate/properties
// @desc    Get all properties for organization
// @access  Private
router.get('/properties', authenticate, async (req, res) => {
  try {
    const {
      status,
      type,
      minPrice,
      maxPrice,
      location,
      featured,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (minPrice) filters.minPrice = parseInt(minPrice);
    if (maxPrice) filters.maxPrice = parseInt(maxPrice);
    if (location) filters.location = location;
    if (featured !== undefined) filters.featured = featured === 'true';

    let properties;
    if (search) {
      properties = await Property.search(search, req.user.organizationId, parseInt(limit), parseInt(offset));
    } else {
      properties = await Property.findByOrganization(
        req.user.organizationId,
        filters,
        parseInt(limit),
        parseInt(offset)
      );
    }

    res.json({
      success: true,
      data: properties,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/properties/:id
// @desc    Get property by ID
// @access  Private
router.get('/properties/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/real-estate/properties
// @desc    Create a new property
// @access  Private
router.post('/properties', authenticate, async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      organizationId: req.user.organizationId,
      createdBy: req.user.id
    };

    const property = await Property.create(propertyData);

    // Trigger auto-matching
    setTimeout(async () => {
      await matchingService.autoMatchAndNotify(req.user.organizationId, property.id);
    }, 1000);

    res.status(201).json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/real-estate/properties/:id
// @desc    Update property
// @access  Private
router.put('/properties/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedProperty = await property.update(req.body);

    res.json({
      success: true,
      data: updatedProperty
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/real-estate/properties/:id
// @desc    Delete property
// @access  Private
router.delete('/properties/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await property.delete();

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/properties/:id/matches
// @desc    Get property matches
// @access  Private
router.get('/properties/:id/matches', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const matches = await property.getMatches();

    res.json({
      success: true,
      data: matches
    });
  } catch (error) {
    console.error('Get property matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/properties/:id/inquiries
// @desc    Get property inquiries
// @access  Private
router.get('/properties/:id/inquiries', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const inquiries = await property.getInquiries(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: inquiries,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get property inquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/buyer-profiles
// @desc    Get all buyer profiles for organization
// @access  Private
router.get('/buyer-profiles', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const buyerProfiles = await BuyerProfile.findByOrganization(
      req.user.organizationId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: buyerProfiles,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get buyer profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/buyer-profiles/:id
// @desc    Get buyer profile by ID
// @access  Private
router.get('/buyer-profiles/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const buyerProfile = await BuyerProfile.findById(id);

    if (!buyerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found'
      });
    }

    // Check ownership
    if (buyerProfile.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: buyerProfile
    });
  } catch (error) {
    console.error('Get buyer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/real-estate/buyer-profiles
// @desc    Create a new buyer profile
// @access  Private
router.post('/buyer-profiles', authenticate, async (req, res) => {
  try {
    const buyerData = {
      ...req.body,
      organizationId: req.user.organizationId
    };

    const buyerProfile = await BuyerProfile.create(buyerData);

    res.status(201).json({
      success: true,
      data: buyerProfile
    });
  } catch (error) {
    console.error('Create buyer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/real-estate/buyer-profiles/:id
// @desc    Update buyer profile
// @access  Private
router.put('/buyer-profiles/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const buyerProfile = await BuyerProfile.findById(id);

    if (!buyerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found'
      });
    }

    // Check ownership
    if (buyerProfile.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedProfile = await buyerProfile.update(req.body);

    res.json({
      success: true,
      data: updatedProfile
    });
  } catch (error) {
    console.error('Update buyer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/buyer-profiles/:id/recommendations
// @desc    Get property recommendations for buyer
// @access  Private
router.get('/buyer-profiles/:id/recommendations', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    const buyerProfile = await BuyerProfile.findById(id);

    if (!buyerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found'
      });
    }

    // Check ownership
    if (buyerProfile.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const recommendations = await buyerProfile.getPropertyRecommendations(parseInt(limit));

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Get buyer recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/real-estate/matching/auto-match
// @desc    Trigger auto-matching for organization
// @access  Private
router.post('/matching/auto-match', authenticate, async (req, res) => {
  try {
    const { propertyId } = req.body;

    const result = await matchingService.autoMatchAndNotify(req.user.organizationId, propertyId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Auto match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/real-estate/matching/search
// @desc    Search properties based on buyer preferences
// @access  Private
router.post('/matching/search', authenticate, async (req, res) => {
  try {
    const { buyerProfileId, searchCriteria } = req.body;

    const buyerProfile = await BuyerProfile.findById(buyerProfileId);

    if (!buyerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found'
      });
    }

    // Check ownership
    if (buyerProfile.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const results = await matchingService.searchProperties(buyerProfileId, searchCriteria);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Property search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/stats/overview
// @desc    Get real estate statistics
// @access  Private
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const [propertyStats, buyerStats, matchingStats] = await Promise.all([
      Property.getStats(req.user.organizationId),
      BuyerProfile.getStats(req.user.organizationId),
      matchingService.getMatchingStats(req.user.organizationId)
    ]);

    res.json({
      success: true,
      data: {
        properties: propertyStats,
        buyers: buyerStats,
        matching: matchingStats
      }
    });
  } catch (error) {
    console.error('Get real estate stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/real-estate/matching/bulk-match
// @desc    Bulk match all buyers with all properties
// @access  Private
router.post('/matching/bulk-match', authenticate, async (req, res) => {
  try {
    const result = await matchingService.bulkMatch(req.user.organizationId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Bulk match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Site Visit Management Routes

// @route   GET /api/real-estate/site-visits
// @desc    Get all site visits for organization
// @access  Private
router.get('/site-visits', authenticate, async (req, res) => {
  try {
    const { status, agentId, limit = 50, offset = 0 } = req.query;
    const { query } = require('../config/database');

    let queryText = `
      SELECT sv.*, p.title as property_title, p.location, c.first_name, c.last_name, u.first_name as agent_first_name, u.last_name as agent_last_name
      FROM site_visits sv
      JOIN properties p ON sv.property_id = p.id
      JOIN contacts c ON sv.buyer_id = c.id
      LEFT JOIN users u ON sv.agent_id = u.id
      WHERE p.organization_id = $1
    `;
    const values = [req.user.organization_id];
    let paramCount = 2;

    if (status) {
      queryText += ` AND sv.status = ${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (agentId) {
      queryText += ` AND sv.agent_id = ${paramCount}`;
      values.push(agentId);
      paramCount++;
    }

    queryText += ` ORDER BY sv.scheduled_at DESC LIMIT ${paramCount} OFFSET ${paramCount + 1}`;
    values.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, values);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get site visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/site-visits/:id
// @desc    Get site visit by ID
// @access  Private
router.get('/site-visits/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { query } = require('../config/database');

    const result = await query(`
      SELECT sv.*, p.title as property_title, p.location, c.first_name, c.last_name, u.first_name as agent_first_name, u.last_name as agent_last_name
      FROM site_visits sv
      JOIN properties p ON sv.property_id = p.id
      JOIN contacts c ON sv.buyer_id = c.id
      LEFT JOIN users u ON sv.agent_id = u.id
      WHERE sv.id = $1 AND p.organization_id = $2
    `, [id, req.user.organization_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site visit not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get site visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/real-estate/site-visits
// @desc    Schedule a new site visit
// @access  Private
router.post('/site-visits', authenticate, async (req, res) => {
  try {
    const {
      propertyId,
      buyerId,
      agentId,
      scheduledAt,
      visitorCount = 1,
      notes,
      specialRequirements
    } = req.body;

    // Validate required fields
    if (!propertyId || !buyerId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'Property ID, buyer ID, and scheduled time are required'
      });
    }

    // Verify property ownership
    const { query } = require('../config/database');
    const propertyCheck = await query(
      'SELECT id FROM properties WHERE id = $1 AND organization_id = $2',
      [propertyId, req.user.organization_id]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found or access denied'
      });
    }

    // Create site visit
    const result = await query(`
      INSERT INTO site_visits (
        property_id, buyer_id, agent_id, scheduled_at, visitor_count,
        notes, special_requirements, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      propertyId,
      buyerId,
      agentId,
      scheduledAt,
      visitorCount,
      notes,
      JSON.stringify(specialRequirements || {}),
      req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Site visit scheduled successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create site visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/real-estate/site-visits/:id
// @desc    Update site visit
// @access  Private
router.put('/site-visits/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { query } = require('../config/database');

    // Check ownership
    const existing = await query(`
      SELECT sv.id FROM site_visits sv
      JOIN properties p ON sv.property_id = p.id
      WHERE sv.id = $1 AND p.organization_id = $2
    `, [id, req.user.organization_id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site visit not found or access denied'
      });
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (key === 'specialRequirements') {
          fields.push(`${key} = ${paramCount}`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${key} = ${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided'
      });
    }

    fields.push('updated_at = NOW()');

    const queryText = `UPDATE site_visits SET ${fields.join(', ')} WHERE id = ${paramCount} RETURNING *`;
    values.push(id);

    const result = await query(queryText, values);

    res.json({
      success: true,
      message: 'Site visit updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update site visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/real-estate/site-visits/:id/complete
// @desc    Mark site visit as completed
// @access  Private
router.post('/site-visits/:id/complete', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback, rating } = req.body;
    const { query } = require('../config/database');

    // Check ownership
    const existing = await query(`
      SELECT sv.id FROM site_visits sv
      JOIN properties p ON sv.property_id = p.id
      WHERE sv.id = $1 AND p.organization_id = $2
    `, [id, req.user.organization_id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site visit not found or access denied'
      });
    }

    const result = await query(`
      UPDATE site_visits
      SET status = 'completed', completed_at = NOW(), feedback = $1, feedback_rating = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [JSON.stringify(feedback || {}), rating, id]);

    res.json({
      success: true,
      message: 'Site visit marked as completed',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Complete site visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/real-estate/site-visits/calendar
// @desc    Get site visits for calendar view
// @access  Private
router.get('/site-visits/calendar', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { query } = require('../config/database');

    let queryText = `
      SELECT sv.*, p.title as property_title, p.location, c.first_name, c.last_name, u.first_name as agent_first_name, u.last_name as agent_last_name
      FROM site_visits sv
      JOIN properties p ON sv.property_id = p.id
      JOIN contacts c ON sv.buyer_id = c.id
      LEFT JOIN users u ON sv.agent_id = u.id
      WHERE p.organization_id = $1
    `;
    const values = [req.user.organization_id];

    if (startDate && endDate) {
      queryText += ' AND sv.scheduled_at >= $2 AND sv.scheduled_at <= $3';
      values.push(startDate, endDate);
    }

    queryText += ' ORDER BY sv.scheduled_at';

    const result = await query(queryText, values);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get calendar site visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;