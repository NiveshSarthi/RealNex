const express = require('express');
const QuickReply = require('../models/QuickReply');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/quick-replies
// @desc    Get quick replies for organization
// @access  Private
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const { category, limit = 100 } = req.query;

    const replies = await QuickReply.findByOrganization(
      req.agent.id,
      category,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: replies
    });
  } catch (error) {
    console.error('Get quick replies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/quick-replies/:id
// @desc    Get quick reply by ID
// @access  Private
router.get('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await QuickReply.findById(id);

    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'Quick reply not found'
      });
    }

    // Check ownership
    if (reply.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: reply
    });
  } catch (error) {
    console.error('Get quick reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/quick-replies
// @desc    Create a new quick reply
// @access  Private
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const { title, action, category, order } = req.body;

    if (!title || !action) {
      return res.status(400).json({
        success: false,
        message: 'Title and action are required'
      });
    }

    const reply = await QuickReply.create({
      organizationId: req.agent.id,
      title,
      action,
      category: category || 'general',
      order: order || 0
    });

    res.status(201).json({
      success: true,
      data: reply
    });
  } catch (error) {
    console.error('Create quick reply error:', error);

    if (error.message.includes('duplicate key')) {
      return res.status(400).json({
        success: false,
        message: 'Quick reply already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/quick-replies/:id
// @desc    Update quick reply
// @access  Private
router.put('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await QuickReply.findById(id);

    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'Quick reply not found'
      });
    }

    // Check ownership
    if (reply.organizationId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedReply = await reply.update(req.body);

    res.json({
      success: true,
      data: updatedReply
    });
  } catch (error) {
    console.error('Update quick reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/quick-replies/:id
// @desc    Delete quick reply
// @access  Private
router.delete('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await QuickReply.findById(id);

    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'Quick reply not found'
      });
    }

    // Check ownership
    if (reply.organizationId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await reply.delete();

    res.json({
      success: true,
      message: 'Quick reply deleted successfully'
    });
  } catch (error) {
    console.error('Delete quick reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/quick-replies/setup-defaults
// @desc    Setup default quick replies for organization
// @access  Private
router.post('/setup-defaults', authenticateAgent, async (req, res) => {
  try {
    const result = await QuickReply.setupDefaultsForOrganization(req.agent.id);

    res.json({
      success: true,
      data: {
        created: result.created.length,
        errors: result.errors.length,
        replies: result.created
      },
      errors: result.errors
    });
  } catch (error) {
    console.error('Setup defaults error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/quick-replies/process
// @desc    Process quick reply shortcut
// @access  Private
router.post('/process', authenticateAgent, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const replyMessage = await QuickReply.processShortcut(req.agent.id, message);

    if (replyMessage) {
      res.json({
        success: true,
        found: true,
        message: replyMessage
      });
    } else {
      res.json({
        success: true,
        found: false,
        message: 'No matching quick reply found'
      });
    }
  } catch (error) {
    console.error('Process quick reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/quick-replies/bulk-create
// @desc    Bulk create quick replies
// @access  Private
router.post('/bulk-create', authenticateAgent, async (req, res) => {
  try {
    const { replies } = req.body;

    if (!replies || !Array.isArray(replies)) {
      return res.status(400).json({
        success: false,
        message: 'Replies array is required'
      });
    }

    const result = await QuickReply.bulkCreate(req.agent.id, replies);

    res.json({
      success: true,
      data: {
        created: result.created.length,
        errors: result.errors.length,
        replies: result.created
      },
      errors: result.errors
    });
  } catch (error) {
    console.error('Bulk create quick replies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/quick-replies/categories
// @desc    Get available quick reply categories
// @access  Private
router.get('/categories', authenticateAgent, (req, res) => {
  const categories = [
    { id: 'navigation', name: 'Navigation', description: 'Main navigation options' },
    { id: 'tools', name: 'Tools', description: 'Calculator and utility tools' },
    { id: 'support', name: 'Support', description: 'Customer support options' },
    { id: 'information', name: 'Information', description: 'Document and info requests' }
  ];

  res.json({
    success: true,
    data: categories
  });
});

// @route   GET /api/quick-replies/stats/overview
// @desc    Get quick reply statistics
// @access  Private
router.get('/stats/overview', authenticateAgent, async (req, res) => {
  try {
    const stats = await QuickReply.getStatsForOrganization(req.agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get quick reply stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/quick-replies/templates
// @desc    Get quick reply templates
// @access  Private
router.get('/templates', authenticateAgent, (req, res) => {
  const templates = QuickReply.getDefaultReplies();

  res.json({
    success: true,
    data: templates
  });
});

module.exports = router;