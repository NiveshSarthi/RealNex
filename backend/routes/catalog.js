const express = require('express');
const CatalogItem = require('../models/CatalogItem');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/catalog
// @desc    Get catalog items for agent
// @access  Private
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const {
      category,
      location,
      bhk,
      minPrice,
      maxPrice,
      status,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {};
    if (category) filters.category = category;
    if (location) filters.location = location;
    if (bhk) filters.bhk = parseInt(bhk);
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (status) filters.status = status;

    const items = await CatalogItem.findByAgent(
      req.agent.id,
      filters,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: items,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get catalog items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/catalog/:id
// @desc    Get catalog item by ID
// @access  Private
router.get('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CatalogItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Catalog item not found'
      });
    }

    // Check ownership
    if (item.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get catalog item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/catalog
// @desc    Create a new catalog item
// @access  Private
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const {
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
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name and price are required'
      });
    }

    // Generate retailer ID if not provided
    const finalRetailerId = retailerId || `prop_${req.agent.id}_${Date.now()}`;

    const item = await CatalogItem.create({
      agentId: req.agent.id,
      retailerId: finalRetailerId,
      name,
      description,
      price: parseFloat(price),
      currency: currency || 'INR',
      imageUrl,
      propertyUrl,
      category,
      location,
      bhk: bhk ? parseInt(bhk) : null,
      areaSqft: areaSqft ? parseFloat(areaSqft) : null,
      status: status || 'available',
      availability: availability || 'in stock',
      tags: tags || []
    });

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Create catalog item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/catalog/:id
// @desc    Update catalog item
// @access  Private
router.put('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CatalogItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Catalog item not found'
      });
    }

    // Check ownership
    if (item.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedItem = await item.update(req.body);

    res.json({
      success: true,
      data: updatedItem
    });
  } catch (error) {
    console.error('Update catalog item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/catalog/:id
// @desc    Delete catalog item
// @access  Private
router.delete('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CatalogItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Catalog item not found'
      });
    }

    // Check ownership
    if (item.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await item.delete();

    res.json({
      success: true,
      message: 'Catalog item deleted successfully'
    });
  } catch (error) {
    console.error('Delete catalog item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/catalog/match
// @desc    Find matching properties based on requirements
// @access  Private
router.post('/match', authenticateAgent, async (req, res) => {
  try {
    const { requirements, limit = 5 } = req.body;

    if (!requirements) {
      return res.status(400).json({
        success: false,
        message: 'Requirements are required'
      });
    }

    const matches = await CatalogItem.findMatchingProperties(
      req.agent.id,
      requirements
    );

    res.json({
      success: true,
      data: matches.slice(0, limit),
      total: matches.length
    });
  } catch (error) {
    console.error('Property matching error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/catalog/share
// @desc    Share property matches via WhatsApp
// @access  Private
router.post('/share', authenticateAgent, async (req, res) => {
  try {
    const { phone, requirements } = req.body;

    if (!phone || !requirements) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and requirements are required'
      });
    }

    // Find matching properties
    const matches = await CatalogItem.findMatchingProperties(
      req.agent.id,
      requirements
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching properties found'
      });
    }

    // Send via WhatsApp
    const whatsappService = require('../services/whatsapp');
    const result = await whatsappService.sharePropertyMatches(
      phone,
      requirements,
      matches.slice(0, 5) // Limit to 5 properties
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Property matches shared successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to share properties',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Share properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/catalog/bulk-import
// @desc    Bulk import catalog items
// @access  Private
router.post('/bulk-import', authenticateAgent, async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    const result = await CatalogItem.bulkImport(req.agent.id, items);

    res.json({
      success: true,
      data: {
        imported: result.imported.length,
        errors: result.errors.length,
        items: result.imported
      },
      errors: result.errors
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/catalog/:id/sync
// @desc    Sync catalog item to WhatsApp
// @access  Private
router.post('/:id/sync', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CatalogItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Catalog item not found'
      });
    }

    // Check ownership
    if (item.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await item.syncToWhatsApp();

    if (result.success) {
      res.json({
        success: true,
        message: 'Item synced to WhatsApp catalog',
        productId: result.productId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to sync to WhatsApp',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Sync to WhatsApp error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/catalog/stats/overview
// @desc    Get catalog statistics
// @access  Private
router.get('/stats/overview', authenticateAgent, async (req, res) => {
  try {
    const stats = await CatalogItem.getStatsForAgent(req.agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get catalog stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;